import { createContext, useContext, useState, useCallback, useMemo, useRef, type ReactNode } from "react";

// Indian Truck Types
export type IndianTruckType = 
  | "Open - 17 Feet" | "Open - 19 Feet" | "Open - 20 Feet" | "Open - 22 Feet" | "Open - 24 Feet"
  | "Open - 10 Wheeler" | "Open - 12 Wheeler" | "Open - 14 Wheeler" | "Open - 16 Wheeler" | "Open - 18 Wheeler"
  | "Container - 20 Ft" | "Container - 32 Ft" | "Container - 40 Ft"
  | "LCV - Tata Ace" | "LCV - Bolero Pickup" | "LCV - 14 Feet" | "LCV - 17 Feet"
  | "Mini/Pickup"
  | "Trailer - 40 Ft" | "Trailer - Triple Axle"
  | "Tipper - 10 Wheeler" | "Tipper - 12 Wheeler"
  | "Tanker - Oil/Fuel" | "Tanker - Water" | "Tanker - Chemical"
  | "Dumper - Hyva" | "Dumper - 10 Wheeler"
  | "Bulker - Cement" | "Bulker - Fly Ash";

export interface CarrierTruck {
  truckId: string;
  truckType: IndianTruckType;
  model: string;
  manufacturer: string;
  makeYear: number;
  licensePlate: string;
  registrationNumber: string;
  chassisNumber: string;
  rcExpiry: Date | null;
  insuranceExpiry: Date | null;
  fitnessExpiry: Date | null;
  permitExpiry: Date | null;
  pucExpiry: Date | null;
  loadCapacity: number;
  bodyType: string;
  lastServiceDate: Date;
  nextServiceDue: Date;
  assignedDriver: string | null;
  assignedDriverId: string | null;
  currentStatus: "Idle" | "On Trip" | "En Route" | "Under Maintenance";
  currentLocation: string;
  fuelLevel: number;
  odometerReading: number;
  // Document URLs for Indian truck compliance
  rcDocumentUrl: string | null;
  insuranceDocumentUrl: string | null;
  fitnessDocumentUrl: string | null;
  permitDocumentUrl: string | null;
  pucDocumentUrl: string | null;
}

// Driver Types
export interface CarrierDriver {
  driverId: string;
  name: string;
  phone: string;
  licenseNumber: string;
  licenseExpiry: Date;
  assignedTruckId: string | null;
  assignedTruckPlate: string | null;
  pastTripsCount: number;
  safetyScore: number;
  performanceRating: number;
  totalEarnings: number;
  availabilityStatus: "Available" | "On Trip" | "Off Duty" | "On Leave";
  joinDate: Date;
  address: string;
}

// Bid Types
export interface NegotiationMessage {
  id: string;
  sender: "carrier" | "shipper";
  message: string;
  amount?: number;
  timestamp: Date;
}

export interface CarrierBid {
  bidId: string;
  loadId: string;
  shipperName: string;
  shipperCompany: string;
  shipperRating: number;
  pickup: string;
  dropoff: string;
  loadType: string;
  weight: number;
  /** @deprecated Prefer routed distance from `/api/distance/calculate` in UI; kept for compatibility. */
  distance: number;
  /** Full route strings for POST /api/distance/calculate (same as carrier loads). */
  routeOrigin?: string;
  routeDestination?: string;
  /** City/geometry fallback when routing is unavailable. */
  estimatedDistanceKm?: number;
  proposedRate: number;
  carrierOffer: number;
  currentRate: number;
  shipperCounterRate: number | null;
  estimatedRevenue: number;
  estimatedProfit: number;
  requiredVehicleType: string;
  bidStatus: "pending" | "countered" | "accepted" | "rejected" | "expired";
  timeLeftToRespond: number;
  submittedAt: Date;
  negotiationHistory: NegotiationMessage[];
}

// Trip Types
export interface TripStop {
  stopId: string;
  location: string;
  type: "pickup" | "checkpoint" | "rest" | "fuel" | "delivery";
  scheduledTime: Date;
  actualTime: Date | null;
  status: "pending" | "completed" | "skipped";
}

export interface TripFuelData {
  fuelConsumed: number;
  costPerLiter: number;
  fuelEfficiency: number;
  totalFuelCost: number;
  refuelAlerts: string[];
  costOverrun: number;
}

export interface TripDriverInsights {
  driverName: string;
  driverLicense: string;
  drivingHoursToday: number;
  breaksTaken: number;
  speedingAlerts: number;
  safetyScore: number;
  harshBrakingEvents: number;
  idleTime: number;
}

export interface TripEvent {
  eventId: string;
  type: "pickup" | "loaded" | "en_route" | "checkpoint" | "delivered" | "delay" | "issue";
  description: string;
  timestamp: Date;
  location: string;
}

export interface CarrierTrip {
  tripId: string;
  loadId: string;
  pickup: string;
  dropoff: string;
  pickupAddress?: string | null;
  pickupLocality?: string | null;
  pickupLandmark?: string | null;
  dropoffAddress?: string | null;
  dropoffLocality?: string | null;
  dropoffLandmark?: string | null;
  dropoffBusinessName?: string | null;
  allStops: TripStop[];
  totalDistance: number;
  completedDistance: number;
  progress: number;
  eta: Date;
  originalEta: Date;
  driverAssigned: string;
  driverAssignedId: string;
  truckAssigned: string;
  truckAssignedId: string;
  loadType: string;
  weight: number;
  rate: number;
  profitabilityEstimate: number;
  status: "awaiting_pickup" | "picked_up" | "in_transit" | "at_checkpoint" | "out_for_delivery" | "delivered";
  currentLocation: string;
  fuel: TripFuelData;
  driverInsights: TripDriverInsights;
  timeline: TripEvent[];
  shipperName: string;
  startDate: Date;
}

// Available Load Types
export interface AvailableLoad {
  loadId: string;
  route: string;
  pickup: string;
  dropoff: string;
  loadType: string;
  weight: number;
  distance: number;
  shipperName: string;
  shipperCompany: string;
  shipperRating: number;
  budget: number;
  expectedRate: number;
  matchScore: number;
  recommendedTrucks: string[];
  nearestDriver: string | null;
  postedAt: Date;
  expiresAt: Date;
  postedByAdmin?: boolean;
  adminFinalPrice?: number | null;
  adminPostMode?: "open" | "invite" | "assign" | null;
  allowCounterBids?: boolean;
  priceFixed?: boolean;
}

// Trip History
export interface CompletedTrip {
  tripId: string;
  loadId: string;
  route: string;
  distanceTraveled: number;
  fuelUsed: number;
  profitEarned: number;
  tripTime: number;
  onTimeDelivery: boolean;
  driverPerformanceRating: number;
  truckPerformanceRating: number;
  shipperRating: number;
  completedAt: Date;
  physicalPodSubmittedAt?: Date | null;
  driverName: string;
  truckPlate: string;
  loadType: string;
}

// Revenue Analytics Types
export interface MonthlyRevenueReport {
  month: string;
  totalRevenue: number;
  avgRevenuePerTrip: number;
  tripsCompleted: number;
  profitMargin: number;
  fuelCost: number;
  tollCost: number;
  driverPay: number;
  maintenanceCost: number;
  platformFees: number;
}

export interface RevenueByTruckType {
  truckType: string;
  revenue: number;
  trips: number;
  avgPerTrip: number;
}

export interface RevenueByDriver {
  driverId: string;
  driverName: string;
  revenue: number;
  trips: number;
  avgPerTrip: number;
  safetyScore: number;
}

export interface RevenueByRegion {
  region: string;
  revenue: number;
  trips: number;
  growth: number;
}

export interface TopShipper {
  shipperId: string;
  shipperName: string;
  totalPaid: number;
  loadsCompleted: number;
  rating: number;
}

export interface CarrierRevenueAnalytics {
  totalRevenue: number;
  monthlyReports: MonthlyRevenueReport[];
  revenueByTruckType: RevenueByTruckType[];
  revenueByDriver: RevenueByDriver[];
  revenueByRegion: RevenueByRegion[];
  topShippers: TopShipper[];
  bidWinRatio: number;
  loadAcceptanceRate: number;
  avgRevenuePerTrip: number;
  yoyGrowth: number;
  bestPerformingTrucks: { truckId: string; plate: string; revenue: number }[];
}

// Fleet Overview
export interface FleetOverview {
  totalTrucks: number;
  activeTrucks: number;
  underMaintenance: number;
  availableNow: number;
  fleetUtilization: number;
  truckTypeBreakdown: { type: string; count: number }[];
  documentExpiryAlerts: { truckId: string; plate: string; documentType: string; expiryDate: Date }[];
}

// Context Type
interface CarrierDataContextType {
  trucks: CarrierTruck[];
  drivers: CarrierDriver[];
  bids: CarrierBid[];
  activeTrips: CarrierTrip[];
  availableLoads: AvailableLoad[];
  completedTrips: CompletedTrip[];
  
  getFleetOverview: () => FleetOverview;
  getTruckDetails: (truckId: string) => CarrierTruck | null;
  getDriverDetails: (driverId: string) => CarrierDriver | null;
  getBidDetails: (bidId: string) => CarrierBid | null;
  getTripDetails: (tripId: string) => CarrierTrip | null;
  getRevenueAnalytics: () => CarrierRevenueAnalytics;
  
  updateBid: (bidId: string, action: "accept" | "counter" | "reject", counterAmount?: number) => void;
  updateBidStatus: (bidId: string, status: CarrierBid["bidStatus"], counterAmount?: number) => void;
  updateTripStatus: (tripId: string, status: CarrierTrip["status"]) => void;
  placeBid: (loadId: string, amount: number) => void;
}

const CarrierDataContext = createContext<CarrierDataContextType | null>(null);

function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

const indianCities = [
  "Delhi", "Mumbai", "Bangalore", "Chennai", "Kolkata", "Hyderabad", "Pune", "Ahmedabad",
  "Jaipur", "Lucknow", "Kanpur", "Nagpur", "Indore", "Bhopal", "Patna", "Vadodara",
  "Ghaziabad", "Ludhiana", "Agra", "Nashik", "Faridabad", "Meerut", "Rajkot", "Varanasi",
  "Srinagar", "Aurangabad", "Dhanbad", "Amritsar", "Allahabad", "Ranchi", "Coimbatore", "Jabalpur",
  "Gwalior", "Vijayawada", "Jodhpur", "Madurai", "Raipur", "Kota", "Chandigarh", "Guwahati"
];

const truckManufacturers = ["Tata", "Ashok Leyland", "BharatBenz", "Eicher", "Mahindra", "Volvo", "Scania", "MAN"];
const truckModels: Record<string, string[]> = {
  "Tata": ["Prima 4028.S", "Signa 4825.TK", "LPT 3118", "Ultra 1918.T"],
  "Ashok Leyland": ["Captain 4019", "U-Truck 2518", "Boss 1920", "Ecomet 1615"],
  "BharatBenz": ["3143 CM", "2528 R", "1617 R", "4928 T"],
  "Eicher": ["Pro 6042", "Pro 3019", "Pro 2095", "Pro 1110"],
  "Mahindra": ["Blazo X 35", "Furio 7", "Jayo", "Optimo"],
  "Volvo": ["FM 420", "FH 540", "FMX 460"],
  "Scania": ["P 410", "R 500", "G 460"],
  "MAN": ["CLA 31.300", "CLA 25.280"]
};

const truckTypes: CarrierTruck["truckType"][] = [
  "Open - 17 Feet", "Open - 20 Feet", "Open - 10 Wheeler", "Open - 14 Wheeler",
  "Container - 20 Ft", "Container - 32 Ft", "LCV - Tata Ace", "LCV - 14 Feet",
  "Trailer - 40 Ft", "Tipper - 10 Wheeler", "Tanker - Oil/Fuel", "Bulker - Cement"
];
const loadTypes = ["FMCG", "Construction", "Machinery", "Perishables", "Chemical", "Bulk Materials", "Electronics", "Textiles", "Automotive", "Pharmaceuticals"];

const indianFirstNames = [
  "Rajesh", "Amit", "Vikram", "Arun", "Suresh", "Rahul", "Sanjay", "Vijay", "Prakash", "Manoj",
  "Ramesh", "Ashok", "Sunil", "Ajay", "Mohan", "Ravi", "Kiran", "Gaurav", "Naveen", "Rohit",
  "Anil", "Dinesh", "Pankaj", "Alok", "Hemant", "Deepak", "Satish", "Mukesh", "Rakesh", "Harish"
];

const indianLastNames = [
  "Sharma", "Patel", "Singh", "Kumar", "Yadav", "Gupta", "Verma", "Mehta", "Chauhan", "Rathore",
  "Joshi", "Mishra", "Pandey", "Tiwari", "Dubey", "Bhardwaj", "Saxena", "Tripathi", "Agarwal", "Bansal"
];

const shipperCompanies = [
  "Reliance Industries", "Tata Steel", "Hindustan Unilever", "ITC Limited", "Nestle India",
  "Asian Paints", "Godrej Consumer", "Dabur India", "Marico Limited", "Britannia Industries",
  "Ultratech Cement", "ACC Cement", "JSW Steel", "Vedanta Limited", "Hindalco Industries",
  "Maruti Suzuki", "Mahindra & Mahindra", "Hero MotoCorp", "Bajaj Auto", "TVS Motor"
];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateDrivers(count: number): CarrierDriver[] {
  const drivers: CarrierDriver[] = [];
  for (let i = 0; i < count; i++) {
    const firstName = randomFrom(indianFirstNames);
    const lastName = randomFrom(indianLastNames);
    drivers.push({
      driverId: `DRV-${1000 + i}`,
      name: `${firstName} ${lastName}`,
      phone: `+91 ${randomBetween(70000, 99999)}${randomBetween(10000, 99999)}`,
      licenseNumber: `DL${randomBetween(10, 99)}${randomBetween(2015, 2022)}${randomBetween(1000000, 9999999)}`,
      licenseExpiry: new Date(Date.now() + randomBetween(30, 730) * 24 * 60 * 60 * 1000),
      assignedTruckId: null,
      assignedTruckPlate: null,
      pastTripsCount: randomBetween(10, 500),
      safetyScore: randomBetween(65, 98),
      performanceRating: 3.5 + Math.random() * 1.5,
      totalEarnings: randomBetween(100000, 2500000),
      availabilityStatus: randomFrom(["Available", "On Trip", "Off Duty", "On Leave"]),
      joinDate: new Date(Date.now() - randomBetween(180, 1825) * 24 * 60 * 60 * 1000),
      address: `${randomBetween(1, 500)}, ${randomFrom(["MG Road", "Station Road", "Gandhi Nagar", "Civil Lines", "Industrial Area"])}, ${randomFrom(indianCities)}`
    });
  }
  return drivers;
}

function generateTrucks(count: number, drivers: CarrierDriver[]): CarrierTruck[] {
  const trucks: CarrierTruck[] = [];
  const availableDrivers = [...drivers];
  
  for (let i = 0; i < count; i++) {
    const manufacturer = randomFrom(truckManufacturers);
    const model = randomFrom(truckModels[manufacturer] || ["Standard Model"]);
    const truckType = randomFrom(truckTypes);
    const status = randomFrom(["Idle", "On Trip", "En Route", "Under Maintenance"] as CarrierTruck["currentStatus"][]);
    
    let assignedDriver: CarrierDriver | null = null;
    if (status !== "Under Maintenance" && availableDrivers.length > 0 && Math.random() > 0.3) {
      const driverIndex = randomBetween(0, availableDrivers.length - 1);
      assignedDriver = availableDrivers.splice(driverIndex, 1)[0];
    }
    
    const truck: CarrierTruck = {
      truckId: `TRK-${1000 + i}`,
      truckType,
      model,
      manufacturer,
      makeYear: randomBetween(2016, 2024),
      licensePlate: `${randomFrom(["MH", "DL", "GJ", "KA", "TN", "UP", "RJ", "MP"])}${randomBetween(10, 99)} ${String.fromCharCode(65 + randomBetween(0, 25))}${String.fromCharCode(65 + randomBetween(0, 25))} ${randomBetween(1000, 9999)}`,
      registrationNumber: `IND/${randomBetween(2016, 2024)}/${randomBetween(100000, 999999)}`,
      chassisNumber: `MAT${randomBetween(100000000, 999999999)}`,
      rcExpiry: new Date(Date.now() + randomBetween(-30, 365) * 24 * 60 * 60 * 1000),
      insuranceExpiry: new Date(Date.now() + randomBetween(-30, 365) * 24 * 60 * 60 * 1000),
      fitnessExpiry: new Date(Date.now() + randomBetween(-15, 180) * 24 * 60 * 60 * 1000),
      permitExpiry: new Date(Date.now() + randomBetween(30, 365) * 24 * 60 * 60 * 1000),
      pucExpiry: new Date(Date.now() + randomBetween(-10, 180) * 24 * 60 * 60 * 1000),
      loadCapacity: randomBetween(8, 40),
      bodyType: truckType,
      lastServiceDate: new Date(Date.now() - randomBetween(15, 90) * 24 * 60 * 60 * 1000),
      nextServiceDue: new Date(Date.now() + randomBetween(15, 90) * 24 * 60 * 60 * 1000),
      assignedDriver: assignedDriver?.name || null,
      assignedDriverId: assignedDriver?.driverId || null,
      currentStatus: status,
      currentLocation: randomFrom(indianCities),
      fuelLevel: randomBetween(15, 95),
      odometerReading: randomBetween(50000, 500000),
      rcDocumentUrl: null,
      insuranceDocumentUrl: null,
      fitnessDocumentUrl: null,
      permitDocumentUrl: null,
      pucDocumentUrl: null,
    };
    
    if (assignedDriver) {
      assignedDriver.assignedTruckId = truck.truckId;
      assignedDriver.assignedTruckPlate = truck.licensePlate;
      if (status === "On Trip" || status === "En Route") {
        assignedDriver.availabilityStatus = "On Trip";
      }
    }
    
    trucks.push(truck);
  }
  return trucks;
}

function generateBids(count: number, trucks: CarrierTruck[]): CarrierBid[] {
  const bids: CarrierBid[] = [];
  
  for (let i = 0; i < count; i++) {
    const pickup = randomFrom(indianCities);
    let dropoff = randomFrom(indianCities);
    while (dropoff === pickup) dropoff = randomFrom(indianCities);
    
    const distance = randomBetween(150, 2500);
    const proposedRate = distance * randomBetween(18, 35);
    const carrierOffer = proposedRate * (0.9 + Math.random() * 0.25);
    const status = randomFrom(["pending", "countered", "accepted", "rejected", "expired"] as CarrierBid["bidStatus"][]);
    
    const negotiationHistory: NegotiationMessage[] = [
      {
        id: `msg-${i}-1`,
        sender: "carrier",
        message: `Initial bid placed`,
        amount: Math.round(carrierOffer),
        timestamp: new Date(Date.now() - randomBetween(1, 48) * 60 * 60 * 1000)
      }
    ];
    
    if (status === "countered" || status === "accepted") {
      negotiationHistory.push({
        id: `msg-${i}-2`,
        sender: "shipper",
        message: "Counter offer",
        amount: Math.round(proposedRate * 0.95),
        timestamp: new Date(Date.now() - randomBetween(0, 24) * 60 * 60 * 1000)
      });
    }
    
    if (status === "accepted") {
      negotiationHistory.push({
        id: `msg-${i}-3`,
        sender: "carrier",
        message: "Accepted the offer",
        amount: Math.round(proposedRate * 0.95),
        timestamp: new Date(Date.now() - randomBetween(0, 12) * 60 * 60 * 1000)
      });
    }
    
    bids.push({
      bidId: `BID-${10000 + i}`,
      loadId: `LD-${20000 + i}`,
      shipperName: `${randomFrom(indianFirstNames)} ${randomFrom(indianLastNames)}`,
      shipperCompany: randomFrom(shipperCompanies),
      shipperRating: 3.5 + Math.random() * 1.5,
      pickup,
      dropoff,
      loadType: randomFrom(loadTypes),
      weight: randomBetween(5, 35),
      distance,
      proposedRate: Math.round(proposedRate),
      carrierOffer: Math.round(carrierOffer),
      currentRate: status === "countered" ? Math.round(proposedRate * 0.95) : Math.round(carrierOffer),
      shipperCounterRate: status === "countered" ? Math.round(proposedRate * 0.95) : null,
      estimatedRevenue: Math.round(carrierOffer),
      estimatedProfit: Math.round(carrierOffer * 0.25),
      requiredVehicleType: randomFrom(truckTypes),
      bidStatus: status,
      timeLeftToRespond: status === "pending" || status === "countered" ? randomBetween(1, 48) : 0,
      submittedAt: new Date(Date.now() - randomBetween(1, 72) * 60 * 60 * 1000),
      negotiationHistory
    });
  }
  return bids;
}

function generateActiveTrips(count: number, trucks: CarrierTruck[], drivers: CarrierDriver[]): CarrierTrip[] {
  const trips: CarrierTrip[] = [];
  const activeTrucks = trucks.filter(t => t.currentStatus === "On Trip" || t.currentStatus === "En Route");
  
  for (let i = 0; i < Math.min(count, activeTrucks.length); i++) {
    const truck = activeTrucks[i];
    const driver = drivers.find(d => d.driverId === truck.assignedDriverId);
    
    const pickup = randomFrom(indianCities);
    let dropoff = randomFrom(indianCities);
    while (dropoff === pickup) dropoff = randomFrom(indianCities);
    
    const totalDistance = randomBetween(300, 2000);
    const progress = randomBetween(10, 90);
    const completedDistance = Math.round(totalDistance * progress / 100);
    
    const stops: TripStop[] = [
      { stopId: `stop-${i}-1`, location: pickup, type: "pickup", scheduledTime: new Date(Date.now() - 24 * 60 * 60 * 1000), actualTime: new Date(Date.now() - 22 * 60 * 60 * 1000), status: "completed" },
    ];
    
    const numCheckpoints = randomBetween(1, 3);
    for (let j = 0; j < numCheckpoints; j++) {
      const checkpointCity = randomFrom(indianCities.filter(c => c !== pickup && c !== dropoff));
      stops.push({
        stopId: `stop-${i}-${j + 2}`,
        location: checkpointCity,
        type: j === 0 && Math.random() > 0.5 ? "fuel" : "checkpoint",
        scheduledTime: new Date(Date.now() + (j - numCheckpoints / 2) * 6 * 60 * 60 * 1000),
        actualTime: progress > (j + 1) * 30 ? new Date(Date.now() - (numCheckpoints - j) * 4 * 60 * 60 * 1000) : null,
        status: progress > (j + 1) * 30 ? "completed" : "pending"
      });
    }
    
    stops.push({
      stopId: `stop-${i}-final`,
      location: dropoff,
      type: "delivery",
      scheduledTime: new Date(Date.now() + randomBetween(4, 24) * 60 * 60 * 1000),
      actualTime: null,
      status: "pending"
    });
    
    const fuelConsumed = completedDistance / randomBetween(3, 5);
    const costPerLiter = randomBetween(95, 110);
    
    const timeline: TripEvent[] = [
      { eventId: `evt-${i}-1`, type: "pickup", description: "Cargo picked up", timestamp: new Date(Date.now() - 22 * 60 * 60 * 1000), location: pickup },
      { eventId: `evt-${i}-2`, type: "loaded", description: "Loading completed, documents verified", timestamp: new Date(Date.now() - 21 * 60 * 60 * 1000), location: pickup },
      { eventId: `evt-${i}-3`, type: "en_route", description: "Started journey", timestamp: new Date(Date.now() - 20 * 60 * 60 * 1000), location: pickup },
    ];
    
    if (progress > 30) {
      timeline.push({ eventId: `evt-${i}-4`, type: "checkpoint", description: "Passed toll plaza", timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000), location: "Highway NH48" });
    }
    if (progress > 50) {
      timeline.push({ eventId: `evt-${i}-5`, type: "checkpoint", description: "Rest stop - Driver break", timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000), location: randomFrom(indianCities) });
    }
    
    trips.push({
      tripId: `TRIP-${5000 + i}`,
      loadId: `LD-${30000 + i}`,
      pickup,
      dropoff,
      allStops: stops,
      totalDistance,
      completedDistance,
      progress,
      eta: new Date(Date.now() + randomBetween(4, 36) * 60 * 60 * 1000),
      originalEta: new Date(Date.now() + randomBetween(4, 36) * 60 * 60 * 1000),
      driverAssigned: driver?.name || truck.assignedDriver || "Unknown Driver",
      driverAssignedId: driver?.driverId || truck.assignedDriverId || "DRV-0000",
      truckAssigned: truck.licensePlate,
      truckAssignedId: truck.truckId,
      loadType: randomFrom(loadTypes),
      weight: randomBetween(5, 30),
      rate: randomBetween(25000, 150000),
      profitabilityEstimate: randomBetween(5000, 35000),
      status: progress < 20 ? "picked_up" : progress < 80 ? "in_transit" : "out_for_delivery",
      currentLocation: truck.currentLocation,
      fuel: {
        fuelConsumed: Math.round(fuelConsumed),
        costPerLiter,
        fuelEfficiency: randomBetween(3, 5),
        totalFuelCost: Math.round(fuelConsumed * costPerLiter),
        refuelAlerts: truck.fuelLevel < 25 ? ["Low fuel - Refuel recommended within 50 km"] : [],
        costOverrun: Math.random() > 0.7 ? randomBetween(500, 3000) : 0
      },
      driverInsights: {
        driverName: driver?.name || "Unknown",
        driverLicense: driver?.licenseNumber || "N/A",
        drivingHoursToday: randomBetween(2, 10),
        breaksTaken: randomBetween(1, 4),
        speedingAlerts: randomBetween(0, 3),
        safetyScore: driver?.safetyScore || randomBetween(70, 95),
        harshBrakingEvents: randomBetween(0, 5),
        idleTime: randomBetween(10, 60)
      },
      timeline,
      shipperName: randomFrom(shipperCompanies),
      startDate: new Date(Date.now() - randomBetween(12, 48) * 60 * 60 * 1000)
    });
  }
  return trips;
}

function generateAvailableLoads(count: number, trucks: CarrierTruck[]): AvailableLoad[] {
  const loads: AvailableLoad[] = [];
  
  for (let i = 0; i < count; i++) {
    const pickup = randomFrom(indianCities);
    let dropoff = randomFrom(indianCities);
    while (dropoff === pickup) dropoff = randomFrom(indianCities);
    
    const distance = randomBetween(100, 2500);
    const weight = randomBetween(5, 35);
    const loadType = randomFrom(loadTypes);
    
    const matchingTrucks = trucks
      .filter(t => t.currentStatus === "Idle" && t.loadCapacity >= weight)
      .slice(0, 3)
      .map(t => t.licensePlate);
    
    const isAdminPosted = i < 25;
    const expectedRate = distance * randomBetween(18, 35);
    const adminFinalPrice = isAdminPosted ? Math.round(expectedRate * 1.08) : null;
    const priceFixed = isAdminPosted ? Math.random() > 0.4 : undefined;
    const matchScore = isAdminPosted && i < 5 ? randomBetween(95, 99) : randomBetween(60, 98);
    
    loads.push({
      loadId: `LD-${40000 + i}`,
      route: `${pickup} to ${dropoff}`,
      pickup,
      dropoff,
      loadType,
      weight,
      distance,
      shipperName: `${randomFrom(indianFirstNames)} ${randomFrom(indianLastNames)}`,
      shipperCompany: randomFrom(shipperCompanies),
      shipperRating: 3.5 + Math.random() * 1.5,
      budget: distance * randomBetween(20, 40),
      expectedRate,
      matchScore,
      recommendedTrucks: matchingTrucks,
      nearestDriver: matchingTrucks.length > 0 ? trucks.find(t => t.licensePlate === matchingTrucks[0])?.assignedDriver || null : null,
      postedAt: new Date(Date.now() - randomBetween(1, 48) * 60 * 60 * 1000),
      expiresAt: new Date(Date.now() + randomBetween(12, 72) * 60 * 60 * 1000),
      postedByAdmin: isAdminPosted,
      adminFinalPrice,
      adminPostMode: isAdminPosted ? (Math.random() > 0.7 ? "invite" : "open") : null,
      allowCounterBids: isAdminPosted ? !priceFixed : undefined,
      priceFixed: priceFixed
    });
  }
  return loads.sort((a, b) => b.matchScore - a.matchScore);
}

function generateCompletedTrips(count: number): CompletedTrip[] {
  const trips: CompletedTrip[] = [];
  
  for (let i = 0; i < count; i++) {
    const pickup = randomFrom(indianCities);
    let dropoff = randomFrom(indianCities);
    while (dropoff === pickup) dropoff = randomFrom(indianCities);
    
    const distance = randomBetween(200, 2000);
    const fuelUsed = distance / randomBetween(3, 5);
    const revenue = distance * randomBetween(20, 35);
    const costs = fuelUsed * randomBetween(95, 110) + randomBetween(2000, 8000);
    
    trips.push({
      tripId: `TRIP-${i + 1}`,
      loadId: `LD-${50000 + i}`,
      route: `${pickup} to ${dropoff}`,
      distanceTraveled: distance,
      fuelUsed: Math.round(fuelUsed),
      profitEarned: Math.round(revenue - costs),
      tripTime: randomBetween(8, 72),
      onTimeDelivery: Math.random() > 0.15,
      driverPerformanceRating: 3.5 + Math.random() * 1.5,
      truckPerformanceRating: 3.5 + Math.random() * 1.5,
      shipperRating: 3.5 + Math.random() * 1.5,
      completedAt: new Date(Date.now() - randomBetween(1, 365) * 24 * 60 * 60 * 1000),
      driverName: `${randomFrom(indianFirstNames)} ${randomFrom(indianLastNames)}`,
      truckPlate: `${randomFrom(["MH", "DL", "GJ", "KA"])}${randomBetween(10, 99)} ${String.fromCharCode(65 + randomBetween(0, 25))}${String.fromCharCode(65 + randomBetween(0, 25))} ${randomBetween(1000, 9999)}`,
      loadType: randomFrom(loadTypes)
    });
  }
  return trips.sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());
}

export function CarrierDataProvider({ children }: { children: ReactNode }) {
  const driversRef = useRef<CarrierDriver[]>([]);
  const trucksRef = useRef<CarrierTruck[]>([]);
  const bidsRef = useRef<CarrierBid[]>([]);
  const activeTripsRef = useRef<CarrierTrip[]>([]);
  const availableLoadsRef = useRef<AvailableLoad[]>([]);
  const completedTripsRef = useRef<CompletedTrip[]>([]);
  
  const [initialized, setInitialized] = useState(false);
  
  if (!initialized) {
    driversRef.current = generateDrivers(60);
    trucksRef.current = generateTrucks(120, driversRef.current);
    bidsRef.current = generateBids(155, trucksRef.current);
    activeTripsRef.current = generateActiveTrips(25, trucksRef.current, driversRef.current);
    availableLoadsRef.current = generateAvailableLoads(80, trucksRef.current);
    completedTripsRef.current = generateCompletedTrips(500);
    setInitialized(true);
  }
  
  const [trucks, setTrucks] = useState<CarrierTruck[]>(trucksRef.current);
  const [drivers, setDrivers] = useState<CarrierDriver[]>(driversRef.current);
  const [bids, setBids] = useState<CarrierBid[]>(bidsRef.current);
  const [activeTrips, setActiveTrips] = useState<CarrierTrip[]>(activeTripsRef.current);
  const [availableLoads, setAvailableLoads] = useState<AvailableLoad[]>(availableLoadsRef.current);
  const [completedTrips] = useState<CompletedTrip[]>(completedTripsRef.current);
  
  const getFleetOverview = useCallback((): FleetOverview => {
    const allTrucks = trucksRef.current;
    const activeTrucks = allTrucks.filter(t => t.currentStatus === "On Trip" || t.currentStatus === "En Route").length;
    const underMaintenance = allTrucks.filter(t => t.currentStatus === "Under Maintenance").length;
    const availableNow = allTrucks.filter(t => t.currentStatus === "Idle").length;
    
    const typeBreakdown: Record<string, number> = {};
    allTrucks.forEach(t => {
      typeBreakdown[t.truckType] = (typeBreakdown[t.truckType] || 0) + 1;
    });
    
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    // Collect all expiring documents from all trucks
    const expiryAlerts: { truckId: string; plate: string; documentType: string; expiryDate: Date }[] = [];
    
    allTrucks.forEach(t => {
      const documents = [
        { type: "Registration Certificate (RC)", date: t.rcExpiry },
        { type: "Insurance", date: t.insuranceExpiry },
        { type: "Fitness Certificate", date: t.fitnessExpiry },
        { type: "Permit", date: t.permitExpiry },
        { type: "PUC Certificate", date: t.pucExpiry }
      ];
      
      documents.forEach(doc => {
        if (!doc.date) return;
        if (doc.date < thirtyDaysFromNow) {
          expiryAlerts.push({
            truckId: t.truckId,
            plate: t.licensePlate,
            documentType: doc.type,
            expiryDate: doc.date
          });
        }
      });
    });
    
    // Sort by expiry date (earliest first)
    expiryAlerts.sort((a, b) => a.expiryDate.getTime() - b.expiryDate.getTime());
    
    return {
      totalTrucks: allTrucks.length,
      activeTrucks,
      underMaintenance,
      availableNow,
      fleetUtilization: Math.round((activeTrucks / allTrucks.length) * 100),
      truckTypeBreakdown: Object.entries(typeBreakdown).map(([type, count]) => ({ type, count })),
      documentExpiryAlerts: expiryAlerts.slice(0, 20)
    };
  }, []);
  
  const getTruckDetails = useCallback((truckId: string): CarrierTruck | null => {
    return trucksRef.current.find(t => t.truckId === truckId) || null;
  }, []);
  
  const getDriverDetails = useCallback((driverId: string): CarrierDriver | null => {
    return driversRef.current.find(d => d.driverId === driverId) || null;
  }, []);
  
  const getBidDetails = useCallback((bidId: string): CarrierBid | null => {
    return bidsRef.current.find(b => b.bidId === bidId) || null;
  }, []);
  
  const getTripDetails = useCallback((tripId: string): CarrierTrip | null => {
    return activeTripsRef.current.find(t => t.tripId === tripId) || null;
  }, []);
  
  const getRevenueAnalytics = useCallback((): CarrierRevenueAnalytics => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const completedTripsList = completedTripsRef.current;
    
    const monthlyReports: MonthlyRevenueReport[] = months.map((month, idx) => {
      const baseRevenue = 800000 + idx * 50000 + randomBetween(-100000, 100000);
      const trips = randomBetween(25, 60);
      const fuelCost = baseRevenue * 0.35;
      const tollCost = baseRevenue * 0.08;
      const driverPay = baseRevenue * 0.18;
      const maintenanceCost = baseRevenue * 0.05;
      const platformFees = baseRevenue * 0.03;
      
      return {
        month,
        totalRevenue: Math.round(baseRevenue),
        avgRevenuePerTrip: Math.round(baseRevenue / trips),
        tripsCompleted: trips,
        profitMargin: randomBetween(18, 32),
        fuelCost: Math.round(fuelCost),
        tollCost: Math.round(tollCost),
        driverPay: Math.round(driverPay),
        maintenanceCost: Math.round(maintenanceCost),
        platformFees: Math.round(platformFees)
      };
    });
    
    const totalRevenue = monthlyReports.reduce((sum, m) => sum + m.totalRevenue, 0);
    
    const revenueByTruckType: RevenueByTruckType[] = truckTypes.map(type => ({
      truckType: type,
      revenue: randomBetween(800000, 3000000),
      trips: randomBetween(30, 150),
      avgPerTrip: randomBetween(18000, 45000)
    }));
    
    const revenueByDriver: RevenueByDriver[] = driversRef.current.slice(0, 10).map(driver => ({
      driverId: driver.driverId,
      driverName: driver.name,
      revenue: randomBetween(300000, 1500000),
      trips: randomBetween(20, 80),
      avgPerTrip: randomBetween(15000, 35000),
      safetyScore: driver.safetyScore
    }));
    
    const regions = ["North India", "South India", "West India", "East India", "Central India"];
    const revenueByRegion: RevenueByRegion[] = regions.map(region => ({
      region,
      revenue: randomBetween(1500000, 4000000),
      trips: randomBetween(50, 200),
      growth: randomBetween(-10, 25)
    }));
    
    const topShippers: TopShipper[] = shipperCompanies.slice(0, 10).map((company, idx) => ({
      shipperId: `SHP-${idx + 1}`,
      shipperName: company,
      totalPaid: randomBetween(500000, 3000000),
      loadsCompleted: randomBetween(10, 80),
      rating: 3.5 + Math.random() * 1.5
    })).sort((a, b) => b.totalPaid - a.totalPaid);
    
    const bestPerformingTrucks = trucksRef.current.slice(0, 5).map(truck => ({
      truckId: truck.truckId,
      plate: truck.licensePlate,
      revenue: randomBetween(400000, 1200000)
    })).sort((a, b) => b.revenue - a.revenue);
    
    return {
      totalRevenue,
      monthlyReports,
      revenueByTruckType,
      revenueByDriver,
      revenueByRegion,
      topShippers,
      bidWinRatio: randomBetween(35, 65),
      loadAcceptanceRate: randomBetween(70, 92),
      avgRevenuePerTrip: Math.round(totalRevenue / completedTripsList.length),
      yoyGrowth: randomBetween(8, 25),
      bestPerformingTrucks
    };
  }, []);
  
  const updateBid = useCallback((bidId: string, action: "accept" | "counter" | "reject", counterAmount?: number) => {
    setBids(prev => prev.map(bid => {
      if (bid.bidId !== bidId) return bid;
      
      const newHistory = [...bid.negotiationHistory];
      if (action === "accept") {
        newHistory.push({
          id: generateId("msg"),
          sender: "carrier",
          message: "Bid accepted",
          amount: bid.currentRate,
          timestamp: new Date()
        });
        return { ...bid, bidStatus: "accepted" as const, negotiationHistory: newHistory };
      } else if (action === "counter" && counterAmount) {
        newHistory.push({
          id: generateId("msg"),
          sender: "carrier",
          message: "Counter offer submitted",
          amount: counterAmount,
          timestamp: new Date()
        });
        return { ...bid, carrierOffer: counterAmount, currentRate: counterAmount, bidStatus: "pending" as const, negotiationHistory: newHistory };
      } else if (action === "reject") {
        newHistory.push({
          id: generateId("msg"),
          sender: "carrier",
          message: "Bid rejected",
          timestamp: new Date()
        });
        return { ...bid, bidStatus: "rejected" as const, negotiationHistory: newHistory };
      }
      return bid;
    }));
  }, []);

  const updateBidStatus = useCallback((bidId: string, status: CarrierBid["bidStatus"], counterAmount?: number) => {
    if (!bidId) return;
    
    setBids(prev => prev.map(bid => {
      if (bid.bidId !== bidId) return bid;
      
      const newHistory = [...bid.negotiationHistory];
      if (status === "countered") {
        const validAmount = counterAmount && !isNaN(counterAmount) ? counterAmount : bid.currentRate;
        newHistory.push({
          id: generateId("msg"),
          sender: "shipper",
          message: "Admin counter offer received",
          amount: validAmount,
          timestamp: new Date()
        });
        return { 
          ...bid, 
          bidStatus: status, 
          shipperCounterRate: validAmount,
          currentRate: validAmount,
          negotiationHistory: newHistory 
        };
      } else if (status === "accepted") {
        newHistory.push({
          id: generateId("msg"),
          sender: "shipper",
          message: "Bid accepted by admin",
          amount: bid.currentRate,
          timestamp: new Date()
        });
        return { ...bid, bidStatus: status, negotiationHistory: newHistory };
      } else if (status === "rejected") {
        newHistory.push({
          id: generateId("msg"),
          sender: "shipper",
          message: "Bid rejected by admin",
          timestamp: new Date()
        });
        return { ...bid, bidStatus: status, negotiationHistory: newHistory };
      }
      return { ...bid, bidStatus: status };
    }));
  }, []);
  
  const updateTripStatus = useCallback((tripId: string, status: CarrierTrip["status"]) => {
    setActiveTrips(prev => prev.map(trip => {
      if (trip.tripId !== tripId) return trip;
      
      const newTimeline = [...trip.timeline];
      newTimeline.push({
        eventId: generateId("evt"),
        type: status === "delivered" ? "delivered" : "checkpoint",
        description: `Status updated to ${status.replace(/_/g, " ")}`,
        timestamp: new Date(),
        location: trip.currentLocation
      });
      
      return { ...trip, status, timeline: newTimeline };
    }));
  }, []);
  
  const placeBid = useCallback((loadId: string, amount: number) => {
    const load = availableLoadsRef.current.find(l => l.loadId === loadId);
    if (!load) return;
    
    const newBid: CarrierBid = {
      bidId: generateId("BID"),
      loadId,
      shipperName: load.shipperName,
      shipperCompany: load.shipperCompany,
      shipperRating: load.shipperRating,
      pickup: load.pickup,
      dropoff: load.dropoff,
      loadType: load.loadType,
      weight: load.weight,
      distance: load.distance,
      proposedRate: load.budget,
      carrierOffer: amount,
      currentRate: amount,
      shipperCounterRate: null,
      estimatedRevenue: amount,
      estimatedProfit: Math.round(amount * 0.25),
      requiredVehicleType: randomFrom(truckTypes),
      bidStatus: "pending",
      timeLeftToRespond: 48,
      submittedAt: new Date(),
      negotiationHistory: [{
        id: generateId("msg"),
        sender: "carrier",
        message: "Initial bid placed",
        amount,
        timestamp: new Date()
      }]
    };
    
    setBids(prev => [newBid, ...prev]);
    setAvailableLoads(prev => prev.filter(l => l.loadId !== loadId));
  }, []);
  
  return (
    <CarrierDataContext.Provider value={{
      trucks,
      drivers,
      bids,
      activeTrips,
      availableLoads,
      completedTrips,
      getFleetOverview,
      getTruckDetails,
      getDriverDetails,
      getBidDetails,
      getTripDetails,
      getRevenueAnalytics,
      updateBid,
      updateBidStatus,
      updateTripStatus,
      placeBid
    }}>
      {children}
    </CarrierDataContext.Provider>
  );
}

export function useCarrierData() {
  const context = useContext(CarrierDataContext);
  if (!context) {
    throw new Error("useCarrierData must be used within a CarrierDataProvider");
  }
  return context;
}
