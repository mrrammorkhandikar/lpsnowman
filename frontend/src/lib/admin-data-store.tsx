import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { useMockData, type MockLoad, type MockBid, type TrackedShipment, type ShipmentDocument } from "./mock-data-store";
import { mockCarriers, type ExtendedCarrier } from "./carrier-data";
import { useDocumentVault, type VaultDocument } from "./document-vault-store";
import { useAuth } from "@/lib/auth-context";
import { apiGet, apiPost, apiPatch } from "@/lib/api-client";
import { queryClient } from "@/lib/queryClient";

/** Admin Users use context; carriers/onboarding use React Query — invalidate when the user directory syncs from API. */
function invalidateAdminQueriesLinkedToUserDirectory() {
  void queryClient.invalidateQueries({ queryKey: ["/api/admin/carriers"] });
  void queryClient.invalidateQueries({ queryKey: ["/api/admin/onboarding-requests"] });
  void queryClient.invalidateQueries({ queryKey: ["/api/admin/onboarding-requests/stats"] });
  void queryClient.invalidateQueries({ queryKey: ["/api/admin/verifications"] });
}

/** Admin users list can be slow in prod; match gateway-friendly timeouts and avoid hanging forever. */
const ADMIN_USERS_GET_TIMEOUT_MS = 90_000;
const ADMIN_USERS_FETCH_ATTEMPTS = 5;
const ADMIN_USERS_RETRY_DELAYS_MS = [400, 900, 2000, 4000] as const;

export interface AdminUser {
  userId: string;
  userNumber?: number;
  displayUserId?: string;
  name: string;
  email: string;
  company: string;
  role: "shipper" | "carrier" | "admin" | "dispatcher";
  status: "active" | "suspended" | "pending" | "inactive";
  dateJoined: Date;
  phone?: string;
  isVerified: boolean;
  lastActive?: Date;
  region: string;
  carrierType?: string | null;
  shipperRole?: string | null;
  adminRoleId?: string | null;
  adminRoleName?: string | null;
  isFullAdmin?: boolean;
}

export interface AdminLoad {
  loadId: string;
  pickupId: string | null; // Unique 4-digit code given to carrier for pickup verification
  shipperId: string;
  shipperName: string;
  pickup: string;
  drop: string;
  // Full address details
  pickupAddress?: string;
  pickupLocality?: string;
  pickupLandmark?: string;
  pickupCity?: string;
  pickupPincode?: string;
  dropoffAddress?: string;
  dropoffLocality?: string;
  dropoffLandmark?: string;
  dropoffBusinessName?: string;
  dropoffCity?: string;
  dropoffPincode?: string;
  weight: number;
  weightUnit: string;
  type: string;
  status: "Active" | "Bidding" | "Assigned" | "En Route" | "Delivered" | "Cancelled" | "Pending" | "Unavailable";
  assignedCarrier: string | null;
  carrierId: string | null;
  createdDate: Date;
  eta: string | null;
  spending: number;
  bidCount: number;
  distance: number;
  dimensions: string;
  priority?: "Normal" | "High" | "Critical";
  title?: string;
  description?: string;
  specialHandling?: string;
  requiredTruckType?: string;
  advancePaid?: number; // advance amount paid to carrier
  remainingCarrierPayout?: number; // remaining amount to be paid to carrier
  _originalId?: string;
}

export interface LoadShipperDetails {
  shipperId: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  address: string;
  isVerified: boolean;
  totalLoadsPosted: number;
  rating: number;
}

export interface LoadCarrierDetails {
  carrierId: string;
  companyName: string;
  contactNumber: string;
  verificationStatus: "verified" | "pending" | "rejected" | "expired";
  rating: number;
  fleetSize: number;
}

export interface LoadVehicleDetails {
  vehicleId: string;
  truckType: string;
  vehicleNumber: string;
  driverName: string;
  driverPhone: string;
  driverLicense: string;
  capacity: string;
  rcStatus: "Valid" | "Expired" | "Pending";
  insuranceStatus: "Valid" | "Expired" | "Pending";
}

export interface LoadBidRecord {
  bidId: string;
  carrierId: string;
  carrierName: string;
  amount: number;
  status: "Pending" | "Accepted" | "Rejected" | "Countered";
  submittedAt: Date;
  counterOffer?: number;
  notes?: string;
  carrierType?: "enterprise" | "solo";
}

export interface LoadNegotiationMessage {
  messageId: string;
  senderId: string;
  senderType: "shipper" | "carrier" | "admin";
  senderName: string;
  message: string;
  timestamp: Date;
}

export interface LoadCostBreakdown {
  baseFreightCost: number;
  fuelSurcharge: number;
  handlingFee: number;
  platformFee: number;
  totalCost: number;
}

export interface LoadDocument {
  documentId: string;
  type: "POD" | "Invoice" | "Insurance" | "BOL" | "Consignment" | "RC" | "DriverLicense" | "Other";
  name: string;
  uploadedAt: Date;
  uploadedBy: string;
  status: "Pending" | "Approved" | "Rejected";
  url?: string;
}

export interface LoadActivityEvent {
  eventId: string;
  type: "created" | "edited" | "bid_received" | "carrier_assigned" | "pickup_scheduled" | "driver_enroute" | "picked_up" | "in_transit" | "checkpoint" | "document_uploaded" | "delivered" | "admin_action" | "status_change";
  description: string;
  timestamp: Date;
  userId?: string;
  userName?: string;
}

export interface LoadRouteInfo {
  pickupCoordinates: { lat: number; lng: number };
  dropCoordinates: { lat: number; lng: number };
  currentLocation?: { lat: number; lng: number };
  estimatedTime: string;
  liveStatus: "Pending Pickup" | "At Pickup" | "Loaded" | "En Route" | "At Checkpoint" | "Delivered";
  checkpoints: { name: string; status: "passed" | "current" | "upcoming"; time?: Date }[];
}

export interface DetailedLoad extends AdminLoad {
  shipperDetails: LoadShipperDetails;
  carrierDetails?: LoadCarrierDetails;
  vehicleDetails?: LoadVehicleDetails;
  bids: LoadBidRecord[];
  negotiations: LoadNegotiationMessage[];
  costBreakdown: LoadCostBreakdown;
  documents: LoadDocument[];
  activityLog: LoadActivityEvent[];
  routeInfo: LoadRouteInfo;
  adminNotes?: string;
}

export interface AdminCarrier {
  carrierId: string;
  companyName: string;
  verificationStatus: "verified" | "pending" | "rejected" | "expired";
  fleetSize: number;
  serviceZones: string[];
  activityLevel: "high" | "medium" | "low";
  rating: number;
  totalDeliveries: number;
  onTimePercent: number;
  email: string;
  phone: string;
  dateJoined: Date;
  reliabilityScore: number;
  avgResponseTime: number;
  completedShipments: number;
}

// Extended Carrier Intelligence Types
export interface CarrierBasicInfo {
  companyType: "Transporter" | "Fleet Owner" | "Logistics Company" | "Broker";
  registeredAddress: string;
  yearFounded: number;
  cinRegistrationId: string;
  gstNumber: string;
}

export interface CarrierIdentity {
  verificationExpiryDate: Date;
  complianceLevel: "Low" | "Medium" | "High";
  riskScore: number;
}

export interface CarrierTruck {
  truckId: string;
  truckNumber: string;
  type: "Mini-truck" | "Pickup" | "20ft Container" | "32ft Container" | "Flatbed" | "Trailer" | "Reefer" | "Tanker";
  model: string;
  capacity: string;
  rcStatus: "Valid" | "Expired" | "Missing";
  insuranceStatus: "Valid" | "Expired" | "Missing";
  fitnessStatus: "Valid" | "Expired" | "Missing";
  driverAssigned: string | null;
  driverPhone: string | null;
  isActive: boolean;
}

export interface CarrierFleetComposition {
  miniTruck: number;
  pickup: number;
  container20ft: number;
  container32ft: number;
  flatbed: number;
  trailer: number;
  reefer: number;
  tanker: number;
}

export interface CarrierFleetUtilization {
  activePercentage: number;
  avgTripLength: number;
  avgLoadAcceptanceRate: number;
}

export interface CarrierPerformance {
  onTimeDeliveryRate: number;
  loadAcceptanceRate: number;
  avgResponseTimeMinutes: number;
  cancellationRate: number;
  totalCompletedDeliveries: number;
  performanceTrend: "up" | "down" | "stable";
}

export interface CarrierBehaviorInsights {
  preferredLoadTypes: string[];
  preferredRegions: string[];
  peakOperatingHours: string;
  repeatBusinessRatio: number;
}

export interface CarrierServiceLane {
  origin: string;
  destination: string;
  frequency: number;
  revenue: number;
}

export interface CarrierServiceZoneDetails {
  activeStates: string[];
  activeCities: string[];
  highFrequencyLanes: CarrierServiceLane[];
  coverageLevel: "Local" | "Regional" | "National" | "Pan-India";
}

export interface CarrierDocument {
  documentId: string;
  category: "Company" | "Fleet";
  type: "GST Certificate" | "PAN Certificate" | "Incorporation" | "RC" | "Insurance" | "Fitness" | "Pollution" | "Driver ID";
  name: string;
  uploadDate: Date;
  expiryDate: Date | null;
  status: "Valid" | "Expired" | "Missing";
  truckId?: string;
  url?: string;
}

export interface CarrierFinancials {
  totalRevenueGenerated: number;
  last12MonthsVolume: number;
  avgTripCost: number;
  paymentBehavior: "Timely" | "Delayed" | "Mixed";
  settlementCycle: number;
  topLanesByRevenue: CarrierServiceLane[];
}

export interface CarrierAssignedLoad {
  loadId: string;
  shipperId: string;
  shipperName: string;
  status: string;
  pickup: string;
  drop: string;
  earnings: number;
  eta: string | null;
  assignedDate: Date;
  rating?: number;
  deliveryPerformance?: "On-Time" | "Delayed" | "Early";
}

export interface CarrierRatingBreakdown {
  communication: number;
  reliability: number;
  consistency: number;
  overall: number;
}

export interface CarrierReview {
  reviewId: string;
  shipperId: string;
  shipperName: string;
  rating: number;
  comment: string;
  date: Date;
}

export interface CarrierHealthIndicators {
  lastActiveDate: Date;
  riskAlerts: string[];
  churnProbability: number;
  expiringDocuments: number;
}

export interface CarrierActivityEvent {
  eventId: string;
  type: "verification" | "document" | "load" | "performance" | "admin_action" | "suspension" | "reactivation";
  description: string;
  timestamp: Date;
  userId?: string;
  userName?: string;
}

export interface DetailedCarrier extends AdminCarrier {
  basicInfo: CarrierBasicInfo;
  identity: CarrierIdentity;
  trucks: CarrierTruck[];
  fleetComposition: CarrierFleetComposition;
  fleetUtilization: CarrierFleetUtilization;
  performance: CarrierPerformance;
  behaviorInsights: CarrierBehaviorInsights;
  serviceZoneDetails: CarrierServiceZoneDetails;
  documents: CarrierDocument[];
  financials: CarrierFinancials;
  currentLoads: CarrierAssignedLoad[];
  pastLoads: CarrierAssignedLoad[];
  ratingBreakdown: CarrierRatingBreakdown;
  reviews: CarrierReview[];
  healthIndicators: CarrierHealthIndicators;
  activityLog: CarrierActivityEvent[];
  adminNotes?: string;
  frequentShippers: { shipperId: string; shipperName: string; loadCount: number }[];
}

// Revenue Intelligence Types
export interface RevenueBySource {
  source: string;
  category: string;
  amount: number;
  percentage: number;
  trend: number;
  color: string;
}

export interface RevenueSourceGroup {
  name: string;
  value: number;
  color: string;
}

export interface ShipperContributor {
  shipperId: string;
  name: string;
  company: string;
  totalSpend: number;
  loadsBooked: number;
  avgSpendPerLoad: number;
  contribution: number;
  region: string;
}

export interface CarrierContributor {
  carrierId: string;
  name: string;
  loadsExecuted: number;
  loadValue: number;
  commissionGenerated: number;
  contribution: number;
  rating: number;
}

export interface LoadTypeRevenue {
  type: string;
  totalLoads: number;
  avgRate: number;
  revenue: number;
  peakMonth: string;
  yoyGrowth: number;
}

export interface RegionRevenue {
  region: string;
  code: string;
  loadsExecuted: number;
  revenue: number;
  yoyGrowth: number;
  topCustomer: string;
  heatValue: number;
}

export interface MonthlyRevenueData {
  month: string;
  fullMonth: string;
  revenue: number;
  loads: number;
  growth: number;
  loadTransactions: number;
  subscriptions: number;
  addOns: number;
  penalties: number;
}

export interface RevenueTransaction {
  date: Date;
  loadId: string;
  shipper: string;
  shipperId: string;
  carrier: string;
  carrierId: string;
  loadValue: number;
  platformFee: number;
  subscriptionFee: number;
  paymentStatus: "Paid" | "Pending" | "Overdue";
  region: string;
  loadType: string;
}

export interface QuarterlyRevenue {
  quarter: string;
  revenue: number;
  loads: number;
  growth: number;
}

export interface RevenueForecast {
  month: string;
  projected: number;
  confidence: number;
}

export interface ProfitInsight {
  label: string;
  value: string | number;
  trend?: number;
  icon: "up" | "down" | "neutral";
}

export interface AIInsight {
  text: string;
  type: "success" | "warning" | "info";
}

export interface RevenueIntelligence {
  totalRevenue: number;
  revenueBySource: RevenueBySource[];
  sourceGroups: RevenueSourceGroup[];
  shipperContributors: ShipperContributor[];
  carrierContributors: CarrierContributor[];
  loadTypeRevenue: LoadTypeRevenue[];
  regionRevenue: RegionRevenue[];
  monthlyRevenue: MonthlyRevenueData[];
  transactions: RevenueTransaction[];
  quarterlyData: QuarterlyRevenue[];
  forecast: RevenueForecast[];
  bestMonth: MonthlyRevenueData;
  worstMonth: MonthlyRevenueData;
  profitInsights: ProfitInsight[];
  aiInsights: AIInsight[];
}

export interface VerificationRequest {
  requestId: string;
  entityType: "carrier" | "shipper" | "document";
  entityId: string;
  entityName: string;
  documentType?: string;
  documentName?: string;
  submittedAt: Date;
  status: "pending" | "approved" | "rejected";
  reviewedBy?: string;
  reviewedAt?: Date;
  notes?: string;
}

export interface TransactionRecord {
  transactionId: string;
  loadId: string;
  route: string;
  shipperId: string;
  shipperName: string;
  carrierId: string;
  carrierName: string;
  amount: number;
  status: "completed" | "pending" | "failed" | "refunded";
  date: Date;
  paymentMethod: string;
}

export interface MonthlyReport {
  month: string;
  year: number;
  totalVolume: number;
  loadCount: number;
  userGrowth: { shippers: number; carriers: number };
  loadDistribution: { completed: number; inTransit: number; pending: number; cancelled: number };
}

export interface RecentActivity {
  id: string;
  type: "user" | "load" | "carrier" | "document" | "transaction";
  message: string;
  entityId?: string;
  timestamp: Date;
  severity: "info" | "warning" | "success" | "error";
}

interface AdminStats {
  totalUsers: number;
  activeLoads: number;
  verifiedCarriers: number;
  pendingVerifications: number;
  monthlyVolume: number;
  monthlyChange: number;
  completedLoads: number;
  inTransitLoads: number;
  pendingLoads: number;
  userGrowthPercent: number;
  loadGrowthPercent: number;
  carrierGrowthPercent: number;
}

interface AdminDataContextType {
  users: AdminUser[];
  loads: AdminLoad[];
  carriers: AdminCarrier[];
  verificationQueue: VerificationRequest[];
  transactions: TransactionRecord[];
  monthlyReports: MonthlyReport[];
  recentActivity: RecentActivity[];
  stats: AdminStats;
  
  addUser: (user: Omit<AdminUser, "userId" | "dateJoined"> & { password: string; adminRoleId?: string | null }) => Promise<AdminUserMutationResult>;
  updateUser: (userId: string, updates: Partial<AdminUser>) => Promise<AdminUserMutationResult>;
  suspendUser: (userId: string) => void;
  activateUser: (userId: string) => void;
  deleteUser: (userId: string) => void;
  
  updateLoad: (loadId: string, updates: Partial<AdminLoad>) => void;
  assignCarrier: (loadId: string, carrierId: string, carrierName: string) => void;
  updateLoadStatus: (loadId: string, status: AdminLoad["status"]) => void;
  getDetailedLoad: (loadId: string) => DetailedLoad | null;
  cancelLoad: (loadId: string) => void;
  addAdminNote: (loadId: string, note: string) => void;
  approveDocument: (loadId: string, documentId: string) => void;
  rejectDocument: (loadId: string, documentId: string) => void;
  
  updateCarrier: (carrierId: string, updates: Partial<AdminCarrier>) => void;
  verifyCarrier: (carrierId: string) => void;
  rejectCarrier: (carrierId: string, reason?: string) => void;
  suspendCarrier: (carrierId: string, reason?: string) => void;
  reactivateCarrier: (carrierId: string) => void;
  getDetailedCarrier: (carrierId: string) => DetailedCarrier | null;
  addCarrierNote: (carrierId: string, note: string) => void;
  invalidateCarrierDocument: (carrierId: string, documentId: string) => void;
  
  approveVerification: (requestId: string, reviewer: string) => void;
  rejectVerification: (requestId: string, reviewer: string, reason?: string) => void;
  
  addActivity: (activity: Omit<RecentActivity, "id" | "timestamp">) => void;
  
  refreshFromShipperPortal: () => Promise<void>;
  syncToShipperPortal: (loadId: string, updates: Partial<MockLoad>) => void;
  
  getRevenueIntelligence: () => RevenueIntelligence;
  
  showAllUsers: boolean;
  setShowAllUsers: (show: boolean) => void;
  /** Explicit refresh (e.g. Admin Users page mount). Avoids constant polling of GET /api/admin/users. */
  refetchUsers: () => Promise<void>;
}

const AdminDataContext = createContext<AdminDataContextType | null>(null);

function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

const indianFirstNames = [
  "Rajesh", "Priya", "Amit", "Neha", "Vikram", "Sunita", "Arun", "Kavitha", "Suresh", "Deepa",
  "Rahul", "Anjali", "Sanjay", "Meera", "Vijay", "Lakshmi", "Prakash", "Rekha", "Manoj", "Shweta",
  "Ramesh", "Pooja", "Ashok", "Divya", "Sunil", "Ritu", "Ajay", "Preeti", "Mohan", "Swathi",
  "Ravi", "Anita", "Kiran", "Sneha", "Gaurav", "Asha", "Naveen", "Bhavna", "Rohit", "Pallavi",
  "Anil", "Jyoti", "Dinesh", "Sapna", "Pankaj", "Nisha", "Alok", "Vandana", "Hemant", "Rashmi"
];

const indianLastNames = [
  "Sharma", "Patel", "Singh", "Kumar", "Reddy", "Rao", "Gupta", "Joshi", "Verma", "Mehta",
  "Agarwal", "Iyer", "Nair", "Menon", "Pillai", "Bhat", "Hegde", "Kaur", "Gill", "Malhotra",
  "Kapoor", "Khanna", "Chopra", "Tandon", "Saxena", "Tripathi", "Pandey", "Mishra", "Dubey", "Tiwari",
  "Chauhan", "Rathore", "Shekhawat", "Bhardwaj", "Yadav", "Srivastava", "Banerjee", "Chatterjee", "Mukherjee", "Das"
];

const companyNames = [
  "Tata Logistics", "Reliance Transport", "Mahindra Freight", "Ashok Leyland Carriers", "Gati Express",
  "BlueDart Cargo", "DTDC Logistics", "Delhivery Express", "Ecom Express", "Shadowfax Logistics",
  "Rivigo Carriers", "SafeExpress", "TCI Express", "VRL Logistics", "Continental Carriers",
  "ABT Industries", "Agarwal Packers", "Om Logistics", "Allied Logistics", "Patel Roadways",
  "Shree Maruti Courier", "XpressBees", "FirstFlight Logistics", "Trackon Logistics", "Professional Couriers",
  "India Post Logistics", "Raj Freight", "Bharat Transport", "National Express", "Express Roadways",
  "Punjab Carriers", "Gujarat Freight", "Maharashtra Logistics", "Karnataka Express", "Tamil Nadu Transport",
  "Kerala Cargo", "Bengal Logistics", "Bihar Carriers", "UP Express", "Rajasthan Roadways"
];

const regions = [
  "North India", "South India", "West India", "East India", "Central India",
  "Delhi NCR", "Mumbai Metropolitan", "Bangalore Urban", "Chennai Metro", "Kolkata Metro",
  "Punjab", "Gujarat", "Maharashtra", "Karnataka", "Tamil Nadu", "Kerala", "Bengal", "UP", "Rajasthan", "MP"
];

const cities = [
  "Delhi", "Mumbai", "Bangalore", "Chennai", "Kolkata", "Hyderabad", "Pune", "Ahmedabad",
  "Jaipur", "Lucknow", "Kanpur", "Nagpur", "Indore", "Bhopal", "Patna", "Vadodara",
  "Ghaziabad", "Ludhiana", "Agra", "Nashik", "Faridabad", "Meerut", "Rajkot", "Varanasi",
  "Srinagar", "Aurangabad", "Dhanbad", "Amritsar", "Allahabad", "Ranchi", "Coimbatore", "Jabalpur",
  "Gwalior", "Vijayawada", "Jodhpur", "Madurai", "Raipur", "Kota", "Chandigarh", "Guwahati"
];

const loadTypes = ["Dry Van", "Refrigerated", "Flatbed", "Container", "Open Body", "Tanker", "LTL", "FTL", "Parcel", "Heavy Haul"];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateEnterpriseUsers(): AdminUser[] {
  const users: AdminUser[] = [];
  const totalUsers = randomBetween(350, 450);
  
  const roleDistribution = {
    shipper: Math.floor(totalUsers * 0.45),
    carrier: Math.floor(totalUsers * 0.40),
    dispatcher: Math.floor(totalUsers * 0.10),
    admin: Math.floor(totalUsers * 0.05),
  };
  
  let userId = 1;
  
  for (const [role, count] of Object.entries(roleDistribution)) {
    for (let i = 0; i < count; i++) {
      const firstName = randomFrom(indianFirstNames);
      const lastName = randomFrom(indianLastNames);
      const company = role === "admin" ? "Load Smart Platform" : randomFrom(companyNames);
      const daysAgo = randomBetween(1, 730);
      const isRecent = daysAgo < 30;
      const status = isRecent && Math.random() < 0.3 ? "pending" : (Math.random() < 0.05 ? "suspended" : "active");
      
      users.push({
        userId: `USR-${String(userId).padStart(4, "0")}`,
        name: `${firstName} ${lastName}`,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${company.toLowerCase().replace(/\s+/g, "")}.com`,
        company,
        role: role as AdminUser["role"],
        status,
        dateJoined: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
        phone: `+91 ${randomBetween(70000, 99999)} ${randomBetween(10000, 99999)}`,
        isVerified: status === "active" && Math.random() > 0.1,
        lastActive: status === "active" ? new Date(Date.now() - randomBetween(0, 48) * 60 * 60 * 1000) : undefined,
        region: randomFrom(regions),
      });
      userId++;
    }
  }
  
  return users;
}

function generateEnterpriseLoads(users: AdminUser[]): AdminLoad[] {
  const loads: AdminLoad[] = [];
  const totalLoads = randomBetween(180, 280);
  const shippers = users.filter(u => u.role === "shipper");
  
  const statusDistribution = {
    "Active": 0.15,
    "Bidding": 0.20,
    "Assigned": 0.10,
    "En Route": 0.25,
    "Delivered": 0.25,
    "Cancelled": 0.03,
    "Pending": 0.02,
  };
  
  for (let i = 0; i < totalLoads; i++) {
    const shipper = randomFrom(shippers);
    const pickup = randomFrom(cities);
    let drop = randomFrom(cities);
    while (drop === pickup) drop = randomFrom(cities);
    
    const rand = Math.random();
    let cumulative = 0;
    let status: AdminLoad["status"] = "Active";
    for (const [s, prob] of Object.entries(statusDistribution)) {
      cumulative += prob;
      if (rand < cumulative) {
        status = s as AdminLoad["status"];
        break;
      }
    }
    
    const daysAgo = randomBetween(0, 60);
    const weight = randomBetween(500, 25000);
    const distance = randomBetween(100, 2500);
    const spending = Math.round(distance * randomBetween(15, 45) + weight * 0.02);
    
    loads.push({
      loadId: `LD-${String(i + 1).padStart(5, "0")}`,
      shipperId: shipper.userId,
      shipperName: shipper.company,
      pickup,
      drop,
      weight,
      weightUnit: "kg",
      type: randomFrom(loadTypes),
      status,
      assignedCarrier: ["Assigned", "En Route", "Delivered"].includes(status) ? randomFrom(companyNames) : null,
      carrierId: ["Assigned", "En Route", "Delivered"].includes(status) ? `CAR-${randomBetween(1, 100)}` : null,
      createdDate: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
      eta: ["En Route", "Assigned"].includes(status) ? `${randomBetween(1, 5)} days` : null,
      spending,
      bidCount: ["Active", "Bidding"].includes(status) ? randomBetween(1, 12) : randomBetween(3, 8),
      distance,
      dimensions: `${randomBetween(4, 20)}ft x ${randomBetween(4, 10)}ft x ${randomBetween(4, 10)}ft`,
    });
  }
  
  return loads;
}

function generateEnterpriseCarriers(): AdminCarrier[] {
  const carriers: AdminCarrier[] = [];
  const totalCarriers = randomBetween(90, 130);
  
  for (let i = 0; i < totalCarriers; i++) {
    const totalDeliveries = randomBetween(10, 800);
    const isHighPerformer = totalDeliveries > 300;
    const rating = isHighPerformer ? 4.2 + Math.random() * 0.8 : 3.5 + Math.random() * 1.0;
    const onTimePercent = isHighPerformer ? randomBetween(88, 99) : randomBetween(70, 92);
    const verificationStatus = Math.random() < 0.75 ? "verified" : (Math.random() < 0.6 ? "pending" : (Math.random() < 0.5 ? "rejected" : "expired"));
    
    const zoneCount = randomBetween(1, 5);
    const serviceZones: string[] = [];
    for (let j = 0; j < zoneCount; j++) {
      const zone = randomFrom(regions);
      if (!serviceZones.includes(zone)) serviceZones.push(zone);
    }
    
    carriers.push({
      carrierId: `CAR-${String(i + 1).padStart(4, "0")}`,
      companyName: randomFrom(companyNames) + (i > companyNames.length ? ` ${i}` : ""),
      verificationStatus,
      fleetSize: randomBetween(2, 150),
      serviceZones,
      activityLevel: totalDeliveries > 300 ? "high" : (totalDeliveries > 80 ? "medium" : "low"),
      rating: Math.round(rating * 10) / 10,
      totalDeliveries,
      onTimePercent,
      email: `contact@carrier${i + 1}.in`,
      phone: `+91 ${randomBetween(70000, 99999)} ${randomBetween(10000, 99999)}`,
      dateJoined: new Date(Date.now() - randomBetween(30, 900) * 24 * 60 * 60 * 1000),
      reliabilityScore: Math.round((rating / 5) * 100),
      avgResponseTime: randomBetween(5, 120),
      completedShipments: Math.floor(totalDeliveries * 0.95),
    });
  }
  
  return carriers;
}

function generateEnterpriseTransactions(loads: AdminLoad[], carriers: AdminCarrier[]): TransactionRecord[] {
  const transactions: TransactionRecord[] = [];
  const completedLoads = loads.filter(l => l.status === "Delivered");
  
  for (const load of completedLoads) {
    const carrier = randomFrom(carriers);
    transactions.push({
      transactionId: `TXN-${transactions.length + 1}`.padStart(8, "0"),
      loadId: load.loadId,
      route: `${load.pickup} to ${load.drop}`,
      shipperId: load.shipperId,
      shipperName: load.shipperName,
      carrierId: carrier.carrierId,
      carrierName: carrier.companyName,
      amount: load.spending,
      status: Math.random() < 0.9 ? "completed" : (Math.random() < 0.5 ? "pending" : "refunded"),
      date: new Date(load.createdDate.getTime() + randomBetween(1, 7) * 24 * 60 * 60 * 1000),
      paymentMethod: randomFrom(["Bank Transfer", "UPI", "Credit Card", "Net Banking", "Wallet"]),
    });
  }
  
  const additionalTransactions = randomBetween(200, 400);
  for (let i = 0; i < additionalTransactions; i++) {
    const carrier = randomFrom(carriers);
    const pickup = randomFrom(cities);
    let drop = randomFrom(cities);
    while (drop === pickup) drop = randomFrom(cities);
    const daysAgo = randomBetween(1, 730);
    
    transactions.push({
      transactionId: `TXN-${String(transactions.length + 1).padStart(6, "0")}`,
      loadId: `LD-H${String(i + 1).padStart(5, "0")}`,
      route: `${pickup} to ${drop}`,
      shipperId: `USR-${String(randomBetween(1, 200)).padStart(4, "0")}`,
      shipperName: randomFrom(companyNames),
      carrierId: carrier.carrierId,
      carrierName: carrier.companyName,
      amount: randomBetween(5000, 150000),
      status: "completed",
      date: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
      paymentMethod: randomFrom(["Bank Transfer", "UPI", "Credit Card", "Net Banking", "Wallet"]),
    });
  }
  
  return transactions.sort((a, b) => b.date.getTime() - a.date.getTime());
}

function generateMonthlyReports(transactions: TransactionRecord[]): MonthlyReport[] {
  const reports: MonthlyReport[] = [];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  
  for (let i = 0; i < 24; i++) {
    const monthsBack = 23 - i;
    const date = new Date(currentYear, currentMonth - monthsBack, 1);
    const year = date.getFullYear();
    const m = date.getMonth();
    
    const monthTransactions = transactions.filter(t => {
      return t.date.getFullYear() === year && t.date.getMonth() === m;
    });
    
    const baseVolume = 15000000 + Math.random() * 20000000;
    const seasonalMultiplier = [0.8, 0.85, 0.95, 1.0, 1.05, 0.9, 0.85, 0.9, 1.1, 1.2, 1.15, 1.3][m];
    const festivalBonus = (m === 9 || m === 10) ? 1.25 : 1;
    const growthFactor = 1 + (i * 0.02);
    
    const totalVolume = monthTransactions.reduce((sum, t) => sum + t.amount, 0) || 
      Math.round(baseVolume * seasonalMultiplier * festivalBonus * growthFactor);
    
    const loadCount = monthTransactions.length || randomBetween(180, 350);
    
    reports.push({
      month: months[m],
      year,
      totalVolume,
      loadCount,
      userGrowth: {
        shippers: 150 + i * 8 + randomBetween(0, 20),
        carriers: 40 + i * 3 + randomBetween(0, 10),
      },
      loadDistribution: {
        completed: Math.floor(loadCount * 0.72),
        inTransit: Math.floor(loadCount * 0.15),
        pending: Math.floor(loadCount * 0.08),
        cancelled: Math.floor(loadCount * 0.05),
      },
    });
  }
  
  return reports;
}

function generateVerificationQueue(carriers: AdminCarrier[], users: AdminUser[]): VerificationRequest[] {
  const queue: VerificationRequest[] = [];
  
  const pendingCarriers = carriers.filter(c => c.verificationStatus === "pending").slice(0, 15);
  for (const carrier of pendingCarriers) {
    queue.push({
      requestId: `VER-C${queue.length + 1}`,
      entityType: "carrier",
      entityId: carrier.carrierId,
      entityName: carrier.companyName,
      submittedAt: new Date(Date.now() - randomBetween(1, 14) * 24 * 60 * 60 * 1000),
      status: "pending",
    });
  }
  
  const pendingUsers = users.filter(u => u.status === "pending").slice(0, 10);
  for (const user of pendingUsers) {
    queue.push({
      requestId: `VER-U${queue.length + 1}`,
      entityType: "shipper",
      entityId: user.userId,
      entityName: user.company,
      submittedAt: new Date(Date.now() - randomBetween(1, 7) * 24 * 60 * 60 * 1000),
      status: "pending",
    });
  }
  
  const docTypes = ["Motor Carrier Authority", "Cargo Insurance", "Liability Insurance", "Driver License", "Vehicle Registration"];
  for (let i = 0; i < 20; i++) {
    const carrier = randomFrom(carriers);
    queue.push({
      requestId: `VER-D${queue.length + 1}`,
      entityType: "document",
      entityId: `DOC-${i + 1}`,
      entityName: carrier.companyName,
      documentType: randomFrom(docTypes),
      documentName: `${randomFrom(docTypes).replace(/\s+/g, "_")}_${randomBetween(2024, 2025)}.pdf`,
      submittedAt: new Date(Date.now() - randomBetween(0, 10) * 24 * 60 * 60 * 1000),
      status: "pending",
    });
  }
  
  return queue;
}

function generateRecentActivity(users: AdminUser[], loads: AdminLoad[], carriers: AdminCarrier[]): RecentActivity[] {
  const activities: RecentActivity[] = [];
  const severityOptions: Array<"info" | "warning" | "success" | "error"> = ["info", "success", "warning"];
  
  const activityTemplates = [
    { type: "user" as const, messages: ["New shipper registered: {company}", "User verified: {name}", "Account suspended: {company}"] },
    { type: "load" as const, messages: ["New load posted: {pickup} to {drop}", "Load delivered: {loadId}", "Carrier assigned to {loadId}"] },
    { type: "carrier" as const, messages: ["Carrier verified: {company}", "New carrier registered: {company}", "Fleet size updated: {company}"] },
    { type: "transaction" as const, messages: ["Payment completed: {amount}", "Refund processed: {amount}", "Invoice generated: {loadId}"] },
  ];
  
  for (let i = 0; i < 50; i++) {
    const template = randomFrom(activityTemplates);
    const messageTemplate = randomFrom(template.messages);
    const severity = randomFrom(severityOptions);
    
    let message = messageTemplate;
    if (messageTemplate.includes("{company}")) message = message.replace("{company}", randomFrom(companyNames));
    if (messageTemplate.includes("{name}")) message = message.replace("{name}", `${randomFrom(indianFirstNames)} ${randomFrom(indianLastNames)}`);
    if (messageTemplate.includes("{pickup}")) message = message.replace("{pickup}", randomFrom(cities));
    if (messageTemplate.includes("{drop}")) message = message.replace("{drop}", randomFrom(cities));
    if (messageTemplate.includes("{loadId}")) message = message.replace("{loadId}", `LD-${String(randomBetween(1, 200)).padStart(5, "0")}`);
    if (messageTemplate.includes("{amount}")) message = message.replace("{amount}", `Rs. ${randomBetween(5000, 150000).toLocaleString()}`);
    
    activities.push({
      id: `ACT-${String(i + 1).padStart(4, "0")}`,
      type: template.type,
      message,
      timestamp: new Date(Date.now() - i * randomBetween(5, 60) * 60 * 1000),
      severity,
    });
  }
  
  return activities;
}

const enterpriseUsers = generateEnterpriseUsers();
const enterpriseLoads = generateEnterpriseLoads(enterpriseUsers);
const enterpriseCarriers = generateEnterpriseCarriers();
const enterpriseTransactions = generateEnterpriseTransactions(enterpriseLoads, enterpriseCarriers);
const enterpriseReports = generateMonthlyReports(enterpriseTransactions);
const enterpriseVerifications = generateVerificationQueue(enterpriseCarriers, enterpriseUsers);
const enterpriseActivity = generateRecentActivity(enterpriseUsers, enterpriseLoads, enterpriseCarriers);

function parseAdminUserApiError(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "Request failed";
  const p = payload as Record<string, unknown>;
  if (typeof p.error === "string") return p.error;
  if (typeof p.message === "string") return p.message;
  if (Array.isArray(p.error)) {
    const parts = p.error
      .map((e) => {
        if (e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string") {
          return (e as { message: string }).message;
        }
        return null;
      })
      .filter(Boolean);
    if (parts.length) return parts.join("; ");
  }
  return "Request failed";
}

function mapApiUserJsonToAdminUser(u: Record<string, unknown>): AdminUser {
  const id = String(u.id ?? "");
  const userNumber = u.userNumber as number | undefined;
  const createdRaw = u.dateJoined ?? u.createdAt;
  const createdAt =
    createdRaw != null && createdRaw !== ""
      ? new Date(createdRaw as string | number | Date)
      : new Date();
  const statusRaw = u.status;
  const status =
    typeof statusRaw === "string" && statusRaw
      ? statusRaw
      : u.isVerified
        ? "active"
        : "pending";
  return {
    userId: id,
    userNumber,
    displayUserId:
      (u.displayUserId as string | undefined) ||
      (userNumber != null ? `USR-${String(userNumber).padStart(3, "0")}` : undefined),
    name: String(u.name ?? u.fullName ?? u.username ?? ""),
    email: String(u.email ?? ""),
    company: String(u.company ?? u.companyName ?? ""),
    role: u.role as AdminUser["role"],
    status: status as AdminUser["status"],
    dateJoined: Number.isNaN(createdAt.getTime()) ? new Date() : createdAt,
    phone: u.phone != null ? String(u.phone) : "",
    isVerified: Boolean(u.isVerified),
    lastActive: u.lastActiveAt
      ? new Date(u.lastActiveAt as string)
      : u.lastActive
        ? new Date(u.lastActive as string)
        : undefined,
    region: String(u.region ?? "India"),
    carrierType: (u.carrierType as string | null | undefined) ?? null,
    shipperRole: (u.shipperRole as string | null | undefined) ?? null,
    adminRoleId: (u.adminRoleId as string | null | undefined) ?? null,
    adminRoleName: (u.adminRoleName as string | null | undefined) ?? null,
    isFullAdmin: u.isFullAdmin === true || (u.role === "admin" && !u.adminRoleId),
  };
}

type AdminUserMutationResult = { ok: true } | { ok: false; message: string };

export function AdminDataProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading, refreshUser } = useAuth();
  const refreshUserRef = useRef(refreshUser);
  useEffect(() => {
    refreshUserRef.current = refreshUser;
  }, [refreshUser]);
  const shipperData = useMockData();
  const documentVault = useDocumentVault();
  
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [adminLoads, setAdminLoads] = useState<AdminLoad[]>(enterpriseLoads);
  const [carriers, setCarriers] = useState<AdminCarrier[]>(enterpriseCarriers);
  const [verificationQueue, setVerificationQueue] = useState<VerificationRequest[]>(enterpriseVerifications);
  const [transactions, setTransactions] = useState<TransactionRecord[]>(enterpriseTransactions);
  const [monthlyReports] = useState<MonthlyReport[]>(enterpriseReports);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>(enterpriseActivity);

  const usersRef = useRef(users);
  const carriersRef = useRef(carriers);
  const adminLoadsRef = useRef(adminLoads);

  useEffect(() => { usersRef.current = users; }, [users]);
  useEffect(() => { carriersRef.current = carriers; }, [carriers]);
  useEffect(() => { adminLoadsRef.current = adminLoads; }, [adminLoads]);

  // Fetch real users from database API
  const [showAllUsers, setShowAllUsers] = useState(false);
  const usersFetchInFlightRef = useRef<Promise<void> | null>(null);

  const fetchUsersFromAPI = useCallback(async () => {
    if (usersFetchInFlightRef.current) {
      return usersFetchInFlightRef.current;
    }
    const run = (async () => {
      try {
        setUsersLoading(true);
        // Use apiGet (same origin rules as /api/auth/me) so production with VITE_API_BASE_URL sends cookies to the API host.
        const path = showAllUsers ? "api/admin/users?showAll=true" : "api/admin/users";

        let loaded = false;
        for (let attempt = 0; attempt < ADMIN_USERS_FETCH_ATTEMPTS && !loaded; attempt++) {
          if (attempt > 0) {
            const delay = ADMIN_USERS_RETRY_DELAYS_MS[attempt - 1] ?? 2000;
            await new Promise((r) => setTimeout(r, delay));
          }
          try {
            let response = await apiGet(path, { timeoutMs: ADMIN_USERS_GET_TIMEOUT_MS });

            if (response.status === 401 && attempt === 0) {
              await refreshUserRef.current();
              response = await apiGet(path, { timeoutMs: ADMIN_USERS_GET_TIMEOUT_MS });
            }

            if (response.ok) {
              const apiUsers = await response.json();
              const mappedUsers: AdminUser[] = apiUsers.map((u: Record<string, unknown>) =>
                mapApiUserJsonToAdminUser(u)
              );
              setUsers(mappedUsers);
              invalidateAdminQueriesLinkedToUserDirectory();
              loaded = true;
              break;
            }

            if (response.status === 401) {
              console.warn("GET /api/admin/users: unauthorized after session refresh");
              break;
            }

            const retriable = [408, 429, 502, 503, 504].includes(response.status);
            if (!retriable || attempt === ADMIN_USERS_FETCH_ATTEMPTS - 1) {
              console.warn("GET /api/admin/users failed:", response.status);
              break;
            }
          } catch (error) {
            console.error("Failed to fetch users from API:", error);
            if (attempt === ADMIN_USERS_FETCH_ATTEMPTS - 1) {
              break;
            }
          }
        }
        // Keep the last good list on failure so the UI does not go blank after a transient error.
      } finally {
        setUsersLoading(false);
      }
    })();
    usersFetchInFlightRef.current = run;
    run.finally(() => {
      usersFetchInFlightRef.current = null;
    });
    return run;
  }, [showAllUsers]);

  const refetchUsers = useCallback(() => fetchUsersFromAPI(), [fetchUsersFromAPI]);

  // Only admins may call GET /api/admin/users. No polling / repeated timer — ever.
  // Fetches only when: admin session is ready (once per fetchUsersFromAPI identity), showAllUsers changes,
  // Users page mount (refetchUsers), Reload, post-load new shipper, onboarding review, or Sync portal.
  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (user?.role !== "admin") {
      setUsersLoading(false);
      return;
    }

    void fetchUsersFromAPI();
  }, [fetchUsersFromAPI, user?.role, authLoading]);

  const syncCarriersFromSource = useCallback(() => {
    const sourceCarriers: AdminCarrier[] = mockCarriers.map((c, idx) => ({
      carrierId: c.id,
      companyName: c.companyName || "Unknown Carrier",
      verificationStatus: c.isVerified ? "verified" : "pending",
      fleetSize: c.carrierProfile?.fleetSize || randomBetween(5, 50),
      serviceZones: c.carrierProfile?.serviceZones || [randomFrom(regions)],
      activityLevel: (c.carrierProfile?.totalDeliveries || 0) > 200 ? "high" : (c.carrierProfile?.totalDeliveries || 0) > 50 ? "medium" : "low",
      rating: parseFloat(c.carrierProfile?.reliabilityScore || "4.0"),
      totalDeliveries: c.carrierProfile?.totalDeliveries || randomBetween(50, 300),
      onTimePercent: c.extendedProfile?.onTimeDeliveryPct || randomBetween(85, 98),
      email: c.email || `carrier${idx}@example.com`,
      phone: c.phone || `+91 ${randomBetween(70000, 99999)} ${randomBetween(10000, 99999)}`,
      dateJoined: c.createdAt || new Date(Date.now() - randomBetween(100, 500) * 24 * 60 * 60 * 1000),
      reliabilityScore: Math.round(parseFloat(c.carrierProfile?.reliabilityScore || "4.0") * 20),
      avgResponseTime: randomBetween(10, 60),
      completedShipments: (c.carrierProfile?.totalDeliveries || 0) * 0.95,
    }));
    
    setCarriers(prev => {
      const existingIds = new Set(sourceCarriers.map(c => c.carrierId));
      const nonSourceCarriers = prev.filter(c => !existingIds.has(c.carrierId));
      return [...sourceCarriers, ...nonSourceCarriers];
    });
  }, []);

  const syncLoadsFromShipper = useCallback(() => {
    const shipperLoads = shipperData.loads;
    const shipperBids = shipperData.bids;
    
    const syncedLoads: AdminLoad[] = shipperLoads.map((load) => {
      const bidsForLoad = shipperBids.filter(b => b.loadId === load.loadId);
      const pickup = randomFrom(cities);
      const drop = randomFrom(cities);
      return {
        loadId: load.loadId,
        shipperId: "USR-0001",
        shipperName: "Demo Shipper",
        pickup: load.pickup || pickup,
        drop: load.drop || drop,
        weight: load.weight || randomBetween(1000, 15000),
        weightUnit: load.weightUnit || "kg",
        type: load.type || randomFrom(loadTypes),
        status: load.status as AdminLoad["status"],
        assignedCarrier: load.carrier,
        carrierId: bidsForLoad.find(b => b.status === "Accepted")?.carrierId || null,
        createdDate: new Date(load.createdAt),
        eta: load.eta,
        spending: load.finalPrice || load.estimatedPrice || 0,
        bidCount: bidsForLoad.length,
        distance: randomBetween(200, 1500),
        dimensions: `${randomBetween(6, 18)}ft x ${randomBetween(6, 10)}ft x ${randomBetween(6, 10)}ft`,
      };
    });
    
    setAdminLoads(prev => {
      const syncedIds = new Set(syncedLoads.map(l => l.loadId));
      const nonSyncedLoads = prev.filter(l => !syncedIds.has(l.loadId));
      return [...syncedLoads, ...nonSyncedLoads];
    });
  }, [shipperData.loads, shipperData.bids]);

  useEffect(() => {
    syncCarriersFromSource();
  }, [syncCarriersFromSource]);

  useEffect(() => {
    syncLoadsFromShipper();
  }, [syncLoadsFromShipper]);

  const currentMonth = monthlyReports[monthlyReports.length - 1];
  const previousMonth = monthlyReports[monthlyReports.length - 2];
  
  const stats: AdminStats = {
    totalUsers: users.length,
    activeLoads: adminLoads.filter(l => ["Active", "Bidding", "Assigned", "En Route"].includes(l.status)).length,
    verifiedCarriers: carriers.filter(c => c.verificationStatus === "verified").length,
    pendingVerifications: verificationQueue.filter(v => v.status === "pending").length,
    monthlyVolume: currentMonth?.totalVolume || 4500000,
    monthlyChange: previousMonth ? Math.round(((currentMonth?.totalVolume || 0) - previousMonth.totalVolume) / previousMonth.totalVolume * 100) : 15,
    completedLoads: adminLoads.filter(l => l.status === "Delivered").length,
    inTransitLoads: adminLoads.filter(l => l.status === "En Route").length,
    pendingLoads: adminLoads.filter(l => ["Active", "Bidding", "Pending"].includes(l.status)).length,
    userGrowthPercent: 12 + Math.floor(Math.random() * 8),
    loadGrowthPercent: 8 + Math.floor(Math.random() * 12),
    carrierGrowthPercent: 5 + Math.floor(Math.random() * 10),
  };

  const addUser = useCallback(
    async (userData: Omit<AdminUser, "userId" | "dateJoined"> & { password: string }): Promise<AdminUserMutationResult> => {
      try {
        const response = await apiPost("api/admin/users", {
          username: userData.name.trim(),
          email: userData.email.trim(),
          password: userData.password,
          role: userData.role,
          companyName: userData.company?.trim() || null,
          phone: userData.phone?.trim() || null,
          isVerified: userData.status === "active" || userData.isVerified === true,
          ...(userData.role === "admin" && userData.adminRoleId
            ? { adminRoleId: userData.adminRoleId }
            : {}),
        });
        if (!response.ok) {
          let payload: unknown;
          try {
            payload = await response.json();
          } catch {
            payload = null;
          }
          return { ok: false, message: parseAdminUserApiError(payload) };
        }
        await refetchUsers();
        return { ok: true };
      } catch (e) {
        console.error("addUser:", e);
        return { ok: false, message: "Network error — could not reach the server" };
      }
    },
    [refetchUsers]
  );

  const updateUser = useCallback(
    async (userId: string, updates: Partial<AdminUser>): Promise<AdminUserMutationResult> => {
      const body: Record<string, unknown> = {};
      if (updates.name !== undefined) body.username = updates.name.trim();
      if (updates.email !== undefined) body.email = updates.email.trim().toLowerCase();
      if (updates.company !== undefined) body.companyName = updates.company.trim() || null;
      if (updates.phone !== undefined) body.phone = updates.phone?.trim() || null;
      if (updates.role !== undefined) body.role = updates.role;
      if (updates.adminRoleId !== undefined) body.adminRoleId = updates.adminRoleId;
      if (updates.isFullAdmin === true) body.adminRoleId = null;
      if (updates.status !== undefined) {
        const s = updates.status;
        if (s === "active") {
          body.isVerified = true;
          body.lastActiveAt = new Date();
        } else if (s === "pending") {
          body.isVerified = false;
        } else if (s === "inactive") {
          body.isVerified = true;
          body.lastActiveAt = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
        } else if (s === "suspended") {
          body.isVerified = false;
        }
      }
      if (updates.isVerified !== undefined && updates.status === undefined) {
        body.isVerified = updates.isVerified;
      }
      if (Object.keys(body).length === 0) {
        return { ok: false, message: "Nothing to update" };
      }
      try {
        const response = await apiPatch(`api/admin/users/${encodeURIComponent(userId)}`, body);
        if (!response.ok) {
          let payload: unknown;
          try {
            payload = await response.json();
          } catch {
            payload = null;
          }
          return { ok: false, message: parseAdminUserApiError(payload) };
        }
        await refetchUsers();
        return { ok: true };
      } catch (e) {
        console.error("updateUser:", e);
        return { ok: false, message: "Network error — could not reach the server" };
      }
    },
    [refetchUsers]
  );

  const suspendUser = useCallback((userId: string) => {
    const user = usersRef.current.find(u => u.userId === userId);
    setUsers(prev => prev.map(u => u.userId === userId ? { ...u, status: "suspended" } : u));
    if (user) {
      addActivity({
        type: "user",
        message: `User suspended: ${user.name}`,
        entityId: userId,
        severity: "warning",
      });
    }
  }, []);

  const activateUser = useCallback((userId: string) => {
    const user = usersRef.current.find(u => u.userId === userId);
    setUsers(prev => prev.map(u => u.userId === userId ? { ...u, status: "active", isVerified: true } : u));
    if (user) {
      addActivity({
        type: "user",
        message: `User activated: ${user.name}`,
        entityId: userId,
        severity: "success",
      });
    }
  }, []);

  const deleteUser = useCallback((userId: string) => {
    setUsers(prev => prev.filter(u => u.userId !== userId));
  }, []);

  const updateLoad = useCallback((loadId: string, updates: Partial<AdminLoad>) => {
    setAdminLoads(prev => prev.map(l => l.loadId === loadId ? { ...l, ...updates } : l));
    if (updates.status) {
      shipperData.updateLoad(loadId, { status: updates.status as MockLoad["status"] });
    }
  }, [shipperData]);

  const assignCarrier = useCallback((loadId: string, carrierId: string, carrierName: string) => {
    setAdminLoads(prev => prev.map(l => 
      l.loadId === loadId 
        ? { ...l, assignedCarrier: carrierName, carrierId, status: "Assigned" as const }
        : l
    ));
    shipperData.updateLoad(loadId, { carrier: carrierName, status: "Assigned" });
    addActivity({
      type: "load",
      message: `Carrier ${carrierName} assigned to load ${loadId}`,
      entityId: loadId,
      severity: "success",
    });
  }, [shipperData]);

  const updateLoadStatus = useCallback((loadId: string, status: AdminLoad["status"]) => {
    setAdminLoads(prev => prev.map(l => l.loadId === loadId ? { ...l, status } : l));
    shipperData.updateLoad(loadId, { status: status as MockLoad["status"] });
    addActivity({
      type: "load",
      message: `Load ${loadId} status changed to ${status}`,
      entityId: loadId,
      severity: "info",
    });
  }, [shipperData]);

  const updateCarrier = useCallback((carrierId: string, updates: Partial<AdminCarrier>) => {
    setCarriers(prev => prev.map(c => c.carrierId === carrierId ? { ...c, ...updates } : c));
  }, []);

  const verifyCarrier = useCallback((carrierId: string) => {
    const carrier = carriersRef.current.find(c => c.carrierId === carrierId);
    setCarriers(prev => prev.map(c => 
      c.carrierId === carrierId ? { ...c, verificationStatus: "verified" } : c
    ));
    setVerificationQueue(prev => prev.map(v => 
      v.entityId === carrierId && v.entityType === "carrier" 
        ? { ...v, status: "approved", reviewedAt: new Date() }
        : v
    ));
    if (carrier) {
      addActivity({
        type: "carrier",
        message: `Carrier verified: ${carrier.companyName}`,
        entityId: carrierId,
        severity: "success",
      });
    }
  }, []);

  const rejectCarrier = useCallback((carrierId: string, reason?: string) => {
    const carrier = carriersRef.current.find(c => c.carrierId === carrierId);
    setCarriers(prev => prev.map(c => 
      c.carrierId === carrierId ? { ...c, verificationStatus: "rejected" } : c
    ));
    setVerificationQueue(prev => prev.map(v => 
      v.entityId === carrierId && v.entityType === "carrier" 
        ? { ...v, status: "rejected", reviewedAt: new Date(), notes: reason }
        : v
    ));
    if (carrier) {
      addActivity({
        type: "carrier",
        message: `Carrier verification rejected: ${carrier.companyName}`,
        entityId: carrierId,
        severity: "error",
      });
    }
  }, []);

  const approveVerification = useCallback((requestId: string, reviewer: string) => {
    const request = verificationQueue.find(v => v.requestId === requestId);
    setVerificationQueue(prev => prev.map(v => 
      v.requestId === requestId 
        ? { ...v, status: "approved", reviewedBy: reviewer, reviewedAt: new Date() }
        : v
    ));
    if (request) {
      if (request.entityType === "carrier") {
        verifyCarrier(request.entityId);
      } else if (request.entityType === "shipper") {
        activateUser(request.entityId);
      }
      addActivity({
        type: request.entityType === "document" ? "document" : request.entityType === "shipper" ? "user" : "carrier",
        message: `Verification approved: ${request.entityName}${request.documentType ? ` - ${request.documentType}` : ""}`,
        entityId: request.entityId,
        severity: "success",
      });
    }
  }, [verificationQueue, verifyCarrier, activateUser]);

  const rejectVerification = useCallback((requestId: string, reviewer: string, reason?: string) => {
    const request = verificationQueue.find(v => v.requestId === requestId);
    setVerificationQueue(prev => prev.map(v => 
      v.requestId === requestId 
        ? { ...v, status: "rejected", reviewedBy: reviewer, reviewedAt: new Date(), notes: reason }
        : v
    ));
    if (request) {
      addActivity({
        type: request.entityType === "document" ? "document" : request.entityType === "shipper" ? "user" : "carrier",
        message: `Verification rejected: ${request.entityName}`,
        entityId: request.entityId,
        severity: "error",
      });
    }
  }, [verificationQueue]);

  const addActivity = useCallback((activity: Omit<RecentActivity, "id" | "timestamp">) => {
    const newActivity: RecentActivity = {
      ...activity,
      id: generateId("ACT"),
      timestamp: new Date(),
    };
    setRecentActivity(prev => [newActivity, ...prev].slice(0, 100));
  }, []);

  const refreshFromShipperPortal = useCallback(async () => {
    syncLoadsFromShipper();
    syncCarriersFromSource();
    if (user?.role === "admin") {
      await fetchUsersFromAPI();
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/loads"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/users"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/carriers"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/bids"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/shipments"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/admin/carriers"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/admin/analytics/realtime"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/admin/verifications"] }),
    ]);
    addActivity({
      type: "load",
      message: "Data synchronized with Shipper Portal",
      severity: "info",
    });
  }, [syncLoadsFromShipper, syncCarriersFromSource, fetchUsersFromAPI, user?.role]);

  const syncToShipperPortal = useCallback((loadId: string, updates: Partial<MockLoad>) => {
    shipperData.updateLoad(loadId, updates);
    addActivity({
      type: "load",
      message: `Load ${loadId} synced to Shipper Portal`,
      entityId: loadId,
      severity: "info",
    });
  }, [shipperData]);

  const getDetailedLoad = useCallback((loadId: string): DetailedLoad | null => {
    const load = adminLoadsRef.current.find(l => l.loadId === loadId);
    if (!load) return null;

    const shipper = usersRef.current.find(u => u.userId === load.shipperId) || usersRef.current.find(u => u.role === "shipper");
    const carrier = load.carrierId ? carriersRef.current.find(c => c.carrierId === load.carrierId) : null;

    const driverFirstName = randomFrom(indianFirstNames);
    const driverLastName = randomFrom(indianLastNames);

    const shipperDetails: LoadShipperDetails = {
      shipperId: shipper?.userId || load.shipperId,
      name: shipper?.name || "Unknown Shipper",
      company: shipper?.company || load.shipperName,
      phone: shipper?.phone || `+91 ${randomBetween(70000, 99999)} ${randomBetween(10000, 99999)}`,
      email: shipper?.email || "shipper@example.com",
      address: `${randomFrom(cities)}, ${shipper?.region || "India"}`,
      isVerified: shipper?.isVerified || false,
      totalLoadsPosted: randomBetween(5, 150),
      rating: 3.5 + Math.random() * 1.5,
    };

    const carrierDetails: LoadCarrierDetails | undefined = carrier ? {
      carrierId: carrier.carrierId,
      companyName: carrier.companyName,
      contactNumber: carrier.phone,
      verificationStatus: carrier.verificationStatus,
      rating: carrier.rating,
      fleetSize: carrier.fleetSize,
    } : undefined;

    const vehicleDetails: LoadVehicleDetails | undefined = carrier ? {
      vehicleId: `VEH-${randomBetween(1000, 9999)}`,
      truckType: load.requiredTruckType || randomFrom(["Flatbed", "Container", "Trailer", "Mini", "Reefer", "Tanker"]),
      vehicleNumber: `${randomFrom(["MH", "DL", "KA", "TN", "GJ", "RJ"])} ${randomBetween(10, 99)} ${randomFrom(["AB", "CD", "EF"])} ${randomBetween(1000, 9999)}`,
      driverName: `${driverFirstName} ${driverLastName}`,
      driverPhone: `+91 ${randomBetween(70000, 99999)} ${randomBetween(10000, 99999)}`,
      driverLicense: `DL-${randomBetween(1000000000, 9999999999)}`,
      capacity: `${randomBetween(5, 25)} tons`,
      rcStatus: Math.random() > 0.1 ? "Valid" : "Pending",
      insuranceStatus: Math.random() > 0.15 ? "Valid" : "Pending",
    } : undefined;

    const bidCount = load.bidCount || randomBetween(3, 12);
    const bids: LoadBidRecord[] = [];
    for (let i = 0; i < bidCount; i++) {
      const bidCarrier = randomFrom(carriersRef.current);
      const isAccepted = carrier && bidCarrier.carrierId === carrier.carrierId;
      // Assign carrier type based on fleet size - fleetSize <= 1 is solo
      const bidCarrierType: "solo" | "enterprise" = bidCarrier.fleetSize <= 1 ? "solo" : "enterprise";
      bids.push({
        bidId: `BID-${loadId}-${i + 1}`,
        carrierId: bidCarrier.carrierId,
        carrierName: bidCarrier.companyName,
        carrierType: bidCarrierType,
        amount: Math.round(load.spending * (0.85 + Math.random() * 0.3)),
        status: isAccepted ? "Accepted" : (Math.random() < 0.2 ? "Rejected" : "Pending"),
        submittedAt: new Date(load.createdDate.getTime() + randomBetween(1, 48) * 60 * 60 * 1000),
        notes: Math.random() > 0.7 ? randomFrom(["Can pickup immediately", "Have experience with this route", "Offering best rate"]) : undefined,
      });
    }

    const negotiations: LoadNegotiationMessage[] = [];
    if (carrier) {
      const messages = [
        { type: "shipper" as const, msg: "Please confirm your availability for this load" },
        { type: "carrier" as const, msg: "Yes, we can handle this. What is your expected pickup time?" },
        { type: "shipper" as const, msg: "We need pickup by tomorrow morning" },
        { type: "carrier" as const, msg: "That works for us. Driver will reach by 8 AM" },
        { type: "shipper" as const, msg: "Perfect. Please share driver details" },
      ];
      messages.forEach((m, idx) => {
        negotiations.push({
          messageId: `MSG-${loadId}-${idx + 1}`,
          senderId: m.type === "shipper" ? shipperDetails.shipperId : carrier.carrierId,
          senderType: m.type,
          senderName: m.type === "shipper" ? shipperDetails.name : carrier.companyName,
          message: m.msg,
          timestamp: new Date(load.createdDate.getTime() + (idx + 2) * 60 * 60 * 1000),
        });
      });
    }

    const baseFreight = Math.round(load.spending * 0.75);
    const fuelSurcharge = Math.round(load.spending * 0.12);
    const handlingFee = Math.round(load.spending * 0.08);
    const platformFee = Math.round(load.spending * 0.05);
    const costBreakdown: LoadCostBreakdown = {
      baseFreightCost: baseFreight,
      fuelSurcharge,
      handlingFee,
      platformFee,
      totalCost: baseFreight + fuelSurcharge + handlingFee + platformFee,
    };

    const documents: LoadDocument[] = [];
    if (["Assigned", "En Route", "Delivered"].includes(load.status)) {
      documents.push(
        { documentId: `DOC-${loadId}-1`, type: "BOL", name: "Bill of Lading.pdf", uploadedAt: new Date(), uploadedBy: shipperDetails.name, status: "Approved" },
        { documentId: `DOC-${loadId}-2`, type: "Consignment", name: "Consignment Note.pdf", uploadedAt: new Date(), uploadedBy: shipperDetails.name, status: "Approved" },
      );
    }
    if (load.status === "Delivered") {
      documents.push(
        { documentId: `DOC-${loadId}-3`, type: "POD", name: "Proof of Delivery.pdf", uploadedAt: new Date(), uploadedBy: carrier?.companyName || "Carrier", status: "Pending" },
        { documentId: `DOC-${loadId}-4`, type: "Invoice", name: "Final Invoice.pdf", uploadedAt: new Date(), uploadedBy: carrier?.companyName || "Carrier", status: "Pending" },
      );
    }

    const activityLog: LoadActivityEvent[] = [
      { eventId: `EVT-${loadId}-1`, type: "created", description: `Load created by ${shipperDetails.company}`, timestamp: load.createdDate, userName: shipperDetails.name },
    ];
    if (bids.length > 0) {
      activityLog.push({ eventId: `EVT-${loadId}-2`, type: "bid_received", description: `${bids.length} bids received`, timestamp: new Date(load.createdDate.getTime() + 2 * 60 * 60 * 1000) });
    }
    if (carrier) {
      activityLog.push({ eventId: `EVT-${loadId}-3`, type: "carrier_assigned", description: `Carrier ${carrier.companyName} assigned`, timestamp: new Date(load.createdDate.getTime() + 12 * 60 * 60 * 1000), userName: "Admin" });
    }
    if (["En Route", "Delivered"].includes(load.status)) {
      activityLog.push({ eventId: `EVT-${loadId}-4`, type: "picked_up", description: "Load picked up from origin", timestamp: new Date(load.createdDate.getTime() + 24 * 60 * 60 * 1000) });
      activityLog.push({ eventId: `EVT-${loadId}-5`, type: "in_transit", description: "Shipment in transit", timestamp: new Date(load.createdDate.getTime() + 26 * 60 * 60 * 1000) });
    }
    if (load.status === "Delivered") {
      activityLog.push({ eventId: `EVT-${loadId}-6`, type: "delivered", description: "Load delivered successfully", timestamp: new Date(load.createdDate.getTime() + 72 * 60 * 60 * 1000) });
    }

    const cityCoords: Record<string, { lat: number; lng: number }> = {
      "Delhi": { lat: 28.6139, lng: 77.2090 },
      "Mumbai": { lat: 19.0760, lng: 72.8777 },
      "Bangalore": { lat: 12.9716, lng: 77.5946 },
      "Chennai": { lat: 13.0827, lng: 80.2707 },
      "Kolkata": { lat: 22.5726, lng: 88.3639 },
      "Hyderabad": { lat: 17.3850, lng: 78.4867 },
      "Pune": { lat: 18.5204, lng: 73.8567 },
      "Ahmedabad": { lat: 23.0225, lng: 72.5714 },
      "Jaipur": { lat: 26.9124, lng: 75.7873 },
      "Lucknow": { lat: 26.8467, lng: 80.9462 },
    };

    const pickupCoords = cityCoords[load.pickup] || { lat: 20.5937 + Math.random() * 10, lng: 78.9629 + Math.random() * 10 };
    const dropCoords = cityCoords[load.drop] || { lat: 20.5937 + Math.random() * 10, lng: 78.9629 + Math.random() * 10 };

    const routeInfo: LoadRouteInfo = {
      pickupCoordinates: pickupCoords,
      dropCoordinates: dropCoords,
      currentLocation: load.status === "En Route" ? {
        lat: pickupCoords.lat + (dropCoords.lat - pickupCoords.lat) * Math.random(),
        lng: pickupCoords.lng + (dropCoords.lng - pickupCoords.lng) * Math.random(),
      } : undefined,
      estimatedTime: `${Math.ceil(load.distance / 50)} hours`,
      liveStatus: load.status === "Delivered" ? "Delivered" : 
                  load.status === "En Route" ? "En Route" : 
                  load.status === "Assigned" ? "Pending Pickup" : "Pending Pickup",
      checkpoints: [
        { name: load.pickup, status: ["En Route", "Delivered"].includes(load.status) ? "passed" : "current" },
        { name: randomFrom(Object.keys(cityCoords)), status: load.status === "Delivered" ? "passed" : load.status === "En Route" ? "current" : "upcoming" },
        { name: load.drop, status: load.status === "Delivered" ? "passed" : "upcoming" },
      ],
    };

    return {
      ...load,
      priority: load.priority || randomFrom(["Normal", "Normal", "Normal", "High", "Critical"]),
      title: load.title || `${load.type} Shipment`,
      description: load.description || `Transport of ${load.weight}${load.weightUnit} ${load.type} cargo from ${load.pickup} to ${load.drop}`,
      specialHandling: load.specialHandling || (load.type === "Refrigerated" ? "Temperature controlled, maintain 2-8°C" : undefined),
      requiredTruckType: load.requiredTruckType || randomFrom(["Flatbed", "Container", "Trailer", "Open Body"]),
      shipperDetails,
      carrierDetails,
      vehicleDetails,
      bids,
      negotiations,
      costBreakdown,
      documents,
      activityLog: activityLog.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()),
      routeInfo,
    };
  }, []);

  const cancelLoad = useCallback((loadId: string) => {
    const load = adminLoadsRef.current.find(l => l.loadId === loadId);
    setAdminLoads(prev => prev.map(l => l.loadId === loadId ? { ...l, status: "Cancelled" as const } : l));
    shipperData.updateLoad(loadId, { status: "Cancelled" });
    if (load) {
      addActivity({
        type: "load",
        message: `Load ${loadId} cancelled by admin`,
        entityId: loadId,
        severity: "warning",
      });
    }
  }, [shipperData]);

  const addAdminNote = useCallback((loadId: string, note: string) => {
    addActivity({
      type: "load",
      message: `Admin note added to load ${loadId}: ${note.substring(0, 50)}...`,
      entityId: loadId,
      severity: "info",
    });
  }, []);

  const approveDocument = useCallback((loadId: string, documentId: string) => {
    addActivity({
      type: "document",
      message: `Document ${documentId} approved for load ${loadId}`,
      entityId: loadId,
      severity: "success",
    });
  }, []);

  const rejectDocument = useCallback((loadId: string, documentId: string) => {
    addActivity({
      type: "document",
      message: `Document ${documentId} rejected for load ${loadId}`,
      entityId: loadId,
      severity: "error",
    });
  }, []);

  const suspendCarrier = useCallback((carrierId: string, reason?: string) => {
    const carrier = carriersRef.current.find(c => c.carrierId === carrierId);
    setCarriers(prev => prev.map(c => 
      c.carrierId === carrierId ? { ...c, verificationStatus: "rejected" as const, activityLevel: "low" as const } : c
    ));
    if (carrier) {
      addActivity({
        type: "carrier",
        message: `Carrier suspended: ${carrier.companyName}${reason ? ` - ${reason}` : ""}`,
        entityId: carrierId,
        severity: "warning",
      });
    }
  }, []);

  const reactivateCarrier = useCallback((carrierId: string) => {
    const carrier = carriersRef.current.find(c => c.carrierId === carrierId);
    setCarriers(prev => prev.map(c => 
      c.carrierId === carrierId ? { ...c, verificationStatus: "verified" as const, activityLevel: "medium" as const } : c
    ));
    if (carrier) {
      addActivity({
        type: "carrier",
        message: `Carrier reactivated: ${carrier.companyName}`,
        entityId: carrierId,
        severity: "success",
      });
    }
  }, []);

  const addCarrierNote = useCallback((carrierId: string, note: string) => {
    const carrier = carriersRef.current.find(c => c.carrierId === carrierId);
    addActivity({
      type: "carrier",
      message: `Admin note added to carrier ${carrier?.companyName || carrierId}: ${note.substring(0, 50)}...`,
      entityId: carrierId,
      severity: "info",
    });
  }, []);

  const invalidateCarrierDocument = useCallback((carrierId: string, documentId: string) => {
    const carrier = carriersRef.current.find(c => c.carrierId === carrierId);
    addActivity({
      type: "document",
      message: `Document ${documentId} marked invalid for carrier ${carrier?.companyName || carrierId}`,
      entityId: carrierId,
      severity: "warning",
    });
  }, []);

  const getDetailedCarrier = useCallback((carrierId: string): DetailedCarrier | null => {
    const carrier = carriersRef.current.find(c => c.carrierId === carrierId);
    if (!carrier) return null;

    const truckTypes: CarrierTruck["type"][] = [
      "Open - 17 Feet", "Open - 20 Feet", "Open - 10 Wheeler", "Open - 14 Wheeler",
      "Container - 20 Ft", "Container - 32 Ft", "LCV - Tata Ace", "LCV - 14 Feet",
      "Trailer - 40 Ft", "Tipper - 10 Wheeler", "Tanker - Oil/Fuel", "Bulker - Cement"
    ];
    const truckModels = ["Tata Prima", "Ashok Leyland 2820", "Mahindra Blazo", "BharatBenz 3143", "Eicher Pro", "Volvo FM", "Scania R-Series", "MAN CLA"];
    
    const basicInfo: CarrierBasicInfo = {
      companyType: randomFrom(["Transporter", "Fleet Owner", "Logistics Company", "Broker"]),
      registeredAddress: `${randomBetween(1, 999)} ${randomFrom(["Industrial Area", "Transport Nagar", "Logistics Hub", "Commercial Complex"])}, ${randomFrom(cities)}, ${randomFrom(regions)}`,
      yearFounded: randomBetween(1990, 2020),
      cinRegistrationId: `U${randomBetween(10000, 99999)}${randomFrom(["MH", "DL", "KA", "TN", "GJ"])}${randomBetween(1990, 2020)}PTC${randomBetween(100000, 999999)}`,
      gstNumber: `${randomBetween(10, 36)}${randomFrom(["AABCT", "AAACT", "AABCM", "AAACM"])}${randomBetween(1000, 9999)}${randomFrom(["A", "B", "C"])}${randomBetween(1, 9)}Z${randomBetween(1, 9)}`,
    };

    const identity: CarrierIdentity = {
      verificationExpiryDate: new Date(Date.now() + randomBetween(30, 365) * 24 * 60 * 60 * 1000),
      complianceLevel: carrier.reliabilityScore > 85 ? "High" : carrier.reliabilityScore > 60 ? "Medium" : "Low",
      riskScore: Math.max(0, 100 - carrier.reliabilityScore + randomBetween(-10, 10)),
    };

    const trucks: CarrierTruck[] = [];
    for (let i = 0; i < carrier.fleetSize; i++) {
      const truckType = randomFrom(truckTypes);
      const driverFirstName = randomFrom(indianFirstNames);
      const driverLastName = randomFrom(indianLastNames);
      const isActive = Math.random() > 0.2;
      trucks.push({
        truckId: `TRK-${carrierId}-${String(i + 1).padStart(3, "0")}`,
        truckNumber: `${randomFrom(["MH", "DL", "KA", "TN", "GJ", "RJ", "UP", "MP"])} ${randomBetween(1, 99)} ${randomFrom(["AB", "CD", "EF", "GH"])} ${randomBetween(1000, 9999)}`,
        type: truckType,
        model: randomFrom(truckModels),
        capacity: truckType.includes("LCV") ? `${randomBetween(2, 7)} tons` : 
                  truckType.includes("Tanker") ? `${randomBetween(10, 24)} KL` : 
                  truckType.includes("17 Feet") || truckType.includes("20 Feet") ? `${randomBetween(8, 15)} tons` :
                  truckType.includes("Container") ? `${randomBetween(15, 30)} tons` :
                  `${randomBetween(16, 40)} tons`,
        rcStatus: Math.random() > 0.15 ? "Valid" : Math.random() > 0.5 ? "Expired" : "Missing",
        insuranceStatus: Math.random() > 0.1 ? "Valid" : Math.random() > 0.5 ? "Expired" : "Missing",
        fitnessStatus: Math.random() > 0.2 ? "Valid" : Math.random() > 0.5 ? "Expired" : "Missing",
        driverAssigned: isActive ? `${driverFirstName} ${driverLastName}` : null,
        driverPhone: isActive ? `+91 ${randomBetween(70000, 99999)} ${randomBetween(10000, 99999)}` : null,
        isActive,
      });
    }

    const fleetComposition: CarrierFleetComposition = {
      miniTruck: trucks.filter(t => t.type.includes("LCV")).length,
      pickup: trucks.filter(t => t.type.includes("17 Feet") || t.type.includes("20 Feet")).length,
      container20ft: trucks.filter(t => t.type.includes("Container")).length,
      container32ft: trucks.filter(t => t.type.includes("Container - 32")).length,
      flatbed: trucks.filter(t => t.type.includes("Open - 10") || t.type.includes("Open - 14")).length,
      trailer: trucks.filter(t => t.type.includes("Trailer")).length,
      reefer: trucks.filter(t => t.type.includes("Bulker")).length,
      tanker: trucks.filter(t => t.type.includes("Tanker")).length,
    };

    const fleetUtilization: CarrierFleetUtilization = {
      activePercentage: Math.round((trucks.filter(t => t.isActive).length / trucks.length) * 100),
      avgTripLength: randomBetween(300, 1500),
      avgLoadAcceptanceRate: randomBetween(60, 95),
    };

    const performance: CarrierPerformance = {
      onTimeDeliveryRate: carrier.onTimePercent,
      loadAcceptanceRate: randomBetween(65, 95),
      avgResponseTimeMinutes: carrier.avgResponseTime,
      cancellationRate: randomBetween(1, 8),
      totalCompletedDeliveries: carrier.completedShipments,
      performanceTrend: carrier.onTimePercent > 85 ? "up" : carrier.onTimePercent > 70 ? "stable" : "down",
    };

    const behaviorInsights: CarrierBehaviorInsights = {
      preferredLoadTypes: [randomFrom(loadTypes), randomFrom(loadTypes), randomFrom(loadTypes)].filter((v, i, a) => a.indexOf(v) === i),
      preferredRegions: carrier.serviceZones.slice(0, 3),
      peakOperatingHours: randomFrom(["6 AM - 2 PM", "8 AM - 4 PM", "10 AM - 6 PM", "2 PM - 10 PM"]),
      repeatBusinessRatio: randomBetween(30, 75),
    };

    const lanes: CarrierServiceLane[] = [];
    for (let i = 0; i < 5; i++) {
      lanes.push({
        origin: randomFrom(cities),
        destination: randomFrom(cities),
        frequency: randomBetween(10, 100),
        revenue: randomBetween(500000, 5000000),
      });
    }

    const serviceZoneDetails: CarrierServiceZoneDetails = {
      activeStates: carrier.serviceZones.filter(z => regions.includes(z)),
      activeCities: [randomFrom(cities), randomFrom(cities), randomFrom(cities), randomFrom(cities), randomFrom(cities)].filter((v, i, a) => a.indexOf(v) === i),
      highFrequencyLanes: lanes.sort((a, b) => b.frequency - a.frequency).slice(0, 5),
      coverageLevel: carrier.serviceZones.length > 10 ? "Pan-India" : carrier.serviceZones.length > 5 ? "National" : carrier.serviceZones.length > 2 ? "Regional" : "Local",
    };

    const documents: CarrierDocument[] = [
      { documentId: `DOC-${carrierId}-GST`, category: "Company", type: "GST Certificate", name: "GST Registration Certificate.pdf", uploadDate: new Date(Date.now() - randomBetween(30, 365) * 24 * 60 * 60 * 1000), expiryDate: null, status: "Valid" },
      { documentId: `DOC-${carrierId}-PAN`, category: "Company", type: "PAN Certificate", name: "PAN Card.pdf", uploadDate: new Date(Date.now() - randomBetween(30, 365) * 24 * 60 * 60 * 1000), expiryDate: null, status: "Valid" },
      { documentId: `DOC-${carrierId}-INC`, category: "Company", type: "Incorporation", name: "Company Registration.pdf", uploadDate: new Date(Date.now() - randomBetween(30, 365) * 24 * 60 * 60 * 1000), expiryDate: null, status: "Valid" },
    ];
    trucks.slice(0, 5).forEach((truck, idx) => {
      documents.push(
        { documentId: `DOC-${carrierId}-RC-${idx}`, category: "Fleet", type: "RC", name: `RC_${truck.truckNumber.replace(/\s/g, "_")}.pdf`, uploadDate: new Date(Date.now() - randomBetween(30, 180) * 24 * 60 * 60 * 1000), expiryDate: new Date(Date.now() + randomBetween(-30, 365) * 24 * 60 * 60 * 1000), status: truck.rcStatus, truckId: truck.truckId },
        { documentId: `DOC-${carrierId}-INS-${idx}`, category: "Fleet", type: "Insurance", name: `Insurance_${truck.truckNumber.replace(/\s/g, "_")}.pdf`, uploadDate: new Date(Date.now() - randomBetween(30, 180) * 24 * 60 * 60 * 1000), expiryDate: new Date(Date.now() + randomBetween(-30, 365) * 24 * 60 * 60 * 1000), status: truck.insuranceStatus, truckId: truck.truckId }
      );
    });

    const financials: CarrierFinancials = {
      totalRevenueGenerated: randomBetween(5000000, 50000000),
      last12MonthsVolume: randomBetween(1000000, 20000000),
      avgTripCost: randomBetween(15000, 80000),
      paymentBehavior: Math.random() > 0.3 ? "Timely" : Math.random() > 0.5 ? "Mixed" : "Delayed",
      settlementCycle: randomFrom([7, 15, 30, 45]),
      topLanesByRevenue: lanes.sort((a, b) => b.revenue - a.revenue).slice(0, 5),
    };

    const currentLoads: CarrierAssignedLoad[] = [];
    const pastLoads: CarrierAssignedLoad[] = [];
    const carrierLoads = adminLoadsRef.current.filter(l => l.carrierId === carrierId || l.assignedCarrier === carrier.companyName);
    carrierLoads.forEach(load => {
      const assignedLoad: CarrierAssignedLoad = {
        loadId: load.loadId,
        shipperId: load.shipperId,
        shipperName: load.shipperName,
        status: load.status,
        pickup: load.pickup,
        drop: load.drop,
        earnings: load.spending,
        eta: load.eta,
        assignedDate: load.createdDate,
        rating: load.status === "Delivered" ? (3.5 + Math.random() * 1.5) : undefined,
        deliveryPerformance: load.status === "Delivered" ? randomFrom(["On-Time", "On-Time", "On-Time", "Delayed", "Early"]) : undefined,
      };
      if (["Active", "Bidding", "Assigned", "En Route"].includes(load.status)) {
        currentLoads.push(assignedLoad);
      } else {
        pastLoads.push(assignedLoad);
      }
    });

    for (let i = pastLoads.length; i < 20; i++) {
      const shipper = randomFrom(usersRef.current.filter(u => u.role === "shipper"));
      pastLoads.push({
        loadId: `LD-HIST-${randomBetween(10000, 99999)}`,
        shipperId: shipper?.userId || `SHP-${randomBetween(100, 999)}`,
        shipperName: shipper?.name || randomFrom(companyNames),
        status: "Delivered",
        pickup: randomFrom(cities),
        drop: randomFrom(cities),
        earnings: randomBetween(20000, 150000),
        eta: null,
        assignedDate: new Date(Date.now() - randomBetween(7, 365) * 24 * 60 * 60 * 1000),
        rating: 3.5 + Math.random() * 1.5,
        deliveryPerformance: randomFrom(["On-Time", "On-Time", "On-Time", "Delayed", "Early"]),
      });
    }

    const ratingBreakdown: CarrierRatingBreakdown = {
      communication: Math.min(5, carrier.rating + (Math.random() - 0.5) * 0.5),
      reliability: Math.min(5, carrier.rating + (Math.random() - 0.5) * 0.5),
      consistency: Math.min(5, carrier.rating + (Math.random() - 0.5) * 0.5),
      overall: carrier.rating,
    };

    const reviewComments = [
      "Very professional service, always on time",
      "Good communication throughout the delivery",
      "Reliable carrier, will use again",
      "Driver was courteous and careful with cargo",
      "Excellent tracking and updates",
      "Competitive pricing and good service",
      "Minor delay but kept us informed",
      "Good experience overall",
    ];

    const reviews: CarrierReview[] = [];
    for (let i = 0; i < randomBetween(5, 15); i++) {
      const shipper = randomFrom(usersRef.current.filter(u => u.role === "shipper"));
      reviews.push({
        reviewId: `REV-${carrierId}-${i + 1}`,
        shipperId: shipper?.userId || `SHP-${randomBetween(100, 999)}`,
        shipperName: shipper?.name || randomFrom(companyNames),
        rating: 3 + Math.random() * 2,
        comment: randomFrom(reviewComments),
        date: new Date(Date.now() - randomBetween(1, 180) * 24 * 60 * 60 * 1000),
      });
    }

    const riskAlerts: string[] = [];
    const expiringDocs = documents.filter(d => d.expiryDate && d.expiryDate < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
    if (expiringDocs.length > 0) riskAlerts.push(`${expiringDocs.length} documents expiring soon`);
    if (carrier.rating < 3.5) riskAlerts.push("Low rating - performance review needed");
    if (performance.cancellationRate > 5) riskAlerts.push("High cancellation rate");
    if (fleetUtilization.activePercentage < 50) riskAlerts.push("Low fleet utilization");

    const healthIndicators: CarrierHealthIndicators = {
      lastActiveDate: new Date(Date.now() - randomBetween(0, 7) * 24 * 60 * 60 * 1000),
      riskAlerts,
      churnProbability: riskAlerts.length > 2 ? randomBetween(40, 70) : riskAlerts.length > 0 ? randomBetween(10, 30) : randomBetween(0, 10),
      expiringDocuments: expiringDocs.length,
    };

    const activityLog: CarrierActivityEvent[] = [
      { eventId: `EVT-${carrierId}-1`, type: "verification", description: "Carrier verified and approved", timestamp: carrier.dateJoined, userName: "System" },
      { eventId: `EVT-${carrierId}-2`, type: "document", description: "GST certificate uploaded", timestamp: new Date(carrier.dateJoined.getTime() + 1 * 24 * 60 * 60 * 1000), userName: carrier.companyName },
      { eventId: `EVT-${carrierId}-3`, type: "document", description: "PAN certificate uploaded", timestamp: new Date(carrier.dateJoined.getTime() + 2 * 24 * 60 * 60 * 1000), userName: carrier.companyName },
    ];
    for (let i = 0; i < randomBetween(5, 15); i++) {
      activityLog.push({
        eventId: `EVT-${carrierId}-${activityLog.length + 1}`,
        type: randomFrom(["load", "performance", "document"]),
        description: randomFrom([
          "Completed load delivery",
          "Accepted new bid",
          "Updated fleet information",
          "Driver document uploaded",
          "Performance milestone achieved",
          "Insurance document renewed",
        ]),
        timestamp: new Date(Date.now() - randomBetween(1, 180) * 24 * 60 * 60 * 1000),
      });
    }

    const frequentShippers = usersRef.current
      .filter(u => u.role === "shipper")
      .slice(0, randomBetween(3, 8))
      .map(shipper => ({
        shipperId: shipper.userId,
        shipperName: shipper.name,
        loadCount: randomBetween(3, 25),
      }));

    return {
      ...carrier,
      basicInfo,
      identity,
      trucks,
      fleetComposition,
      fleetUtilization,
      performance,
      behaviorInsights,
      serviceZoneDetails,
      documents,
      financials,
      currentLoads,
      pastLoads: pastLoads.slice(0, 20),
      ratingBreakdown,
      reviews,
      healthIndicators,
      activityLog: activityLog.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()),
      frequentShippers,
    };
  }, []);

  const getRevenueIntelligence = useCallback((): RevenueIntelligence => {
    const loadTypesForRevenue = ["FMCG", "Construction", "Machinery", "Perishables", "Chemical", "Bulk Materials", "Electronics", "Textiles", "Automotive", "Pharmaceuticals"];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const fullMonths = ["January 2024", "February 2024", "March 2024", "April 2024", "May 2024", "June 2024", "July 2024", "August 2024", "September 2024", "October 2024", "November 2024", "December 2024"];
    const revenueRegions = [
      { name: "North India", code: "N" },
      { name: "West India", code: "W" },
      { name: "South India", code: "S" },
      { name: "East India", code: "E" },
      { name: "NCR", code: "NCR" },
      { name: "Gujarat", code: "GJ" },
      { name: "Maharashtra", code: "MH" },
      { name: "Punjab", code: "PB" },
    ];

    const totalRevenue = 32600000;

    const revenueBySource: RevenueBySource[] = [
      { source: "Load Transactions", category: "Freight commissions", amount: totalRevenue * 0.65, percentage: 65, trend: 12.4, color: "hsl(217, 91%, 48%)" },
      { source: "Load Transactions", category: "Platform fee per load", amount: totalRevenue * 0.12, percentage: 12, trend: 8.2, color: "hsl(217, 91%, 58%)" },
      { source: "Subscription Revenue", category: "Shipper subscriptions", amount: totalRevenue * 0.08, percentage: 8, trend: 15.6, color: "hsl(142, 76%, 36%)" },
      { source: "Subscription Revenue", category: "Carrier premium subscriptions", amount: totalRevenue * 0.05, percentage: 5, trend: 22.1, color: "hsl(142, 76%, 46%)" },
      { source: "Subscription Revenue", category: "Enterprise accounts", amount: totalRevenue * 0.03, percentage: 3, trend: 18.9, color: "hsl(142, 76%, 56%)" },
      { source: "Add-on Services", category: "Document verification fees", amount: totalRevenue * 0.025, percentage: 2.5, trend: 5.3, color: "hsl(48, 96%, 53%)" },
      { source: "Add-on Services", category: "Priority support", amount: totalRevenue * 0.015, percentage: 1.5, trend: 7.8, color: "hsl(48, 96%, 63%)" },
      { source: "Add-on Services", category: "Analytics upgrades", amount: totalRevenue * 0.01, percentage: 1, trend: 25.4, color: "hsl(48, 96%, 73%)" },
      { source: "Penalty/Adjustment", category: "Late cancellation fees", amount: totalRevenue * 0.012, percentage: 1.2, trend: -3.2, color: "hsl(0, 72%, 51%)" },
      { source: "Penalty/Adjustment", category: "Delay penalties", amount: totalRevenue * 0.008, percentage: 0.8, trend: -8.5, color: "hsl(0, 72%, 61%)" },
    ];

    const sourceGroups: RevenueSourceGroup[] = [
      { name: "Load Transactions", value: totalRevenue * 0.77, color: "hsl(217, 91%, 48%)" },
      { name: "Subscriptions", value: totalRevenue * 0.16, color: "hsl(142, 76%, 36%)" },
      { name: "Add-on Services", value: totalRevenue * 0.05, color: "hsl(48, 96%, 53%)" },
      { name: "Penalties", value: totalRevenue * 0.02, color: "hsl(0, 72%, 51%)" },
    ];

    const shippers = usersRef.current.filter(u => u.role === "shipper").slice(0, 15);
    const shipperContributors: ShipperContributor[] = shippers.map((shipper) => {
      const spend = randomBetween(500000, 5000000);
      const loads = randomBetween(15, 120);
      return {
        shipperId: shipper.userId,
        name: shipper.name,
        company: shipper.company,
        totalSpend: spend,
        loadsBooked: loads,
        avgSpendPerLoad: Math.round(spend / loads),
        contribution: (spend / totalRevenue) * 100,
        region: shipper.region,
      };
    }).sort((a, b) => b.totalSpend - a.totalSpend);

    const carrierContributors: CarrierContributor[] = carriersRef.current.slice(0, 10).map((carrier) => {
      const loads = randomBetween(30, 200);
      const loadValue = randomBetween(2000000, 10000000);
      const commission = loadValue * 0.08;
      return {
        carrierId: carrier.carrierId,
        name: carrier.companyName,
        loadsExecuted: loads,
        loadValue,
        commissionGenerated: commission,
        contribution: (commission / (totalRevenue * 0.77)) * 100,
        rating: carrier.rating,
      };
    }).sort((a, b) => b.commissionGenerated - a.commissionGenerated);

    const loadTypeRevenue: LoadTypeRevenue[] = loadTypesForRevenue.map((type) => ({
      type,
      totalLoads: randomBetween(50, 300),
      avgRate: randomBetween(25000, 85000),
      revenue: randomBetween(1500000, 6000000),
      peakMonth: randomFrom(fullMonths),
      yoyGrowth: randomBetween(-15, 35),
    })).sort((a, b) => b.revenue - a.revenue);

    const regionRevenue: RegionRevenue[] = revenueRegions.map((region) => ({
      region: region.name,
      code: region.code,
      loadsExecuted: randomBetween(100, 600),
      revenue: randomBetween(2000000, 8000000),
      yoyGrowth: randomBetween(-10, 30),
      topCustomer: randomFrom(shippers)?.company || "ABC Logistics",
      heatValue: Math.random(),
    })).sort((a, b) => b.revenue - a.revenue);

    const monthlyRevenue: MonthlyRevenueData[] = months.map((month, idx) => {
      const baseRevenue = 2200000 + idx * 150000 + randomBetween(-200000, 200000);
      return {
        month,
        fullMonth: fullMonths[idx],
        revenue: baseRevenue,
        loads: randomBetween(180, 350),
        growth: idx > 0 ? randomBetween(-8, 15) : 0,
        loadTransactions: baseRevenue * 0.77,
        subscriptions: baseRevenue * 0.16,
        addOns: baseRevenue * 0.05,
        penalties: baseRevenue * 0.02,
      };
    });

    const revenueTransactions: RevenueTransaction[] = [];
    for (let i = 0; i < 100; i++) {
      const loadValue = randomBetween(20000, 150000);
      const shipper = randomFrom(shippers);
      const carrier = randomFrom(carriersRef.current);
      revenueTransactions.push({
        date: new Date(Date.now() - randomBetween(0, 365) * 24 * 60 * 60 * 1000),
        loadId: `LD-${randomBetween(10000, 99999)}`,
        shipper: shipper?.company || "Unknown",
        shipperId: shipper?.userId || `SHP-${randomBetween(1000, 9999)}`,
        carrier: carrier?.companyName || "Unknown",
        carrierId: carrier?.carrierId || `CAR-${randomBetween(1000, 9999)}`,
        loadValue,
        platformFee: loadValue * 0.08,
        subscriptionFee: randomBetween(0, 500),
        paymentStatus: randomFrom(["Paid", "Paid", "Paid", "Pending", "Overdue"]),
        region: randomFrom(revenueRegions).name,
        loadType: randomFrom(loadTypesForRevenue),
      });
    }
    revenueTransactions.sort((a, b) => b.date.getTime() - a.date.getTime());

    const quarterlyData: QuarterlyRevenue[] = [
      { quarter: "Q1 2024", revenue: monthlyRevenue.slice(0, 3).reduce((s, m) => s + m.revenue, 0), loads: monthlyRevenue.slice(0, 3).reduce((s, m) => s + m.loads, 0), growth: 8.5 },
      { quarter: "Q2 2024", revenue: monthlyRevenue.slice(3, 6).reduce((s, m) => s + m.revenue, 0), loads: monthlyRevenue.slice(3, 6).reduce((s, m) => s + m.loads, 0), growth: 12.3 },
      { quarter: "Q3 2024", revenue: monthlyRevenue.slice(6, 9).reduce((s, m) => s + m.revenue, 0), loads: monthlyRevenue.slice(6, 9).reduce((s, m) => s + m.loads, 0), growth: 15.7 },
      { quarter: "Q4 2024", revenue: monthlyRevenue.slice(9, 12).reduce((s, m) => s + m.revenue, 0), loads: monthlyRevenue.slice(9, 12).reduce((s, m) => s + m.loads, 0), growth: 18.2 },
    ];

    const forecast: RevenueForecast[] = [
      { month: "Jan 2025", projected: 3100000, confidence: 85 },
      { month: "Feb 2025", projected: 3250000, confidence: 78 },
      { month: "Mar 2025", projected: 3400000, confidence: 72 },
    ];

    const sortedMonths = [...monthlyRevenue].sort((a, b) => b.revenue - a.revenue);
    const bestMonth = sortedMonths[0];
    const worstMonth = sortedMonths[sortedMonths.length - 1];

    const profitInsights: ProfitInsight[] = [
      { label: "Gross Revenue", value: totalRevenue, trend: 14.2, icon: "up" },
      { label: "Estimated Cost", value: totalRevenue * 0.68, trend: 5.8, icon: "up" },
      { label: "Estimated Profit Margin", value: "32%", trend: 2.1, icon: "up" },
      { label: "CAC (Customer Acquisition)", value: 12500, trend: -5.3, icon: "down" },
      { label: "LTV (Lifetime Value)", value: 285000, trend: 18.7, icon: "up" },
    ];

    const aiInsights: AIInsight[] = [
      { text: "Machinery loads show the highest revenue contribution this quarter.", type: "success" },
      { text: `${shipperContributors[0]?.company || "Top shipper"} is your top-paying customer this month.`, type: "info" },
      { text: "Revenue dropped 11.9% in August due to fewer loads in North India.", type: "warning" },
      { text: "Subscription revenue is growing 22% faster than load transactions.", type: "success" },
      { text: "Consider expanding in East India - low penetration but high growth potential.", type: "info" },
    ];

    return {
      totalRevenue,
      revenueBySource,
      sourceGroups,
      shipperContributors,
      carrierContributors,
      loadTypeRevenue,
      regionRevenue,
      monthlyRevenue,
      transactions: revenueTransactions,
      quarterlyData,
      forecast,
      bestMonth,
      worstMonth,
      profitInsights,
      aiInsights,
    };
  }, []);

  return (
    <AdminDataContext.Provider value={{
      users,
      loads: adminLoads,
      carriers,
      verificationQueue,
      transactions,
      monthlyReports,
      recentActivity,
      stats,
      addUser,
      updateUser,
      suspendUser,
      activateUser,
      deleteUser,
      updateLoad,
      assignCarrier,
      updateLoadStatus,
      getDetailedLoad,
      cancelLoad,
      addAdminNote,
      approveDocument,
      rejectDocument,
      updateCarrier,
      verifyCarrier,
      rejectCarrier,
      suspendCarrier,
      reactivateCarrier,
      getDetailedCarrier,
      addCarrierNote,
      invalidateCarrierDocument,
      approveVerification,
      rejectVerification,
      addActivity,
      refreshFromShipperPortal,
      syncToShipperPortal,
      getRevenueIntelligence,
      showAllUsers,
      setShowAllUsers,
      refetchUsers,
    }}>
      {children}
    </AdminDataContext.Provider>
  );
}

export function useAdminData() {
  const context = useContext(AdminDataContext);
  if (!context) {
    throw new Error("useAdminData must be used within an AdminDataProvider");
  }
  return context;
}
