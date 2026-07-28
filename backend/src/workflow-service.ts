import { storage } from "./storage";
import { validStateTransitions, LoadStatus, BidStatus } from "@shared/schema";
import type { Load, Bid, User } from "@shared/schema";
import { 
  broadcastLoadUpdated, 
  broadcastBidAccepted, 
  broadcastBidRejected 
} from "./websocket-marketplace";

/**
 * Workflow Service - Centralized business logic for the Admin-Managed Freight Exchange
 * 
 * LOAD LIFECYCLE (12 Core States):
 * draft → pending → priced → posted_to_carriers → open_for_bid → counter_received → awarded 
 *      → invoice_created → invoice_sent → invoice_acknowledged → invoice_paid → in_transit → delivered → closed
 * 
 * RULES:
 * 1. State transitions must follow validStateTransitions map
 * 2. Role-based visibility enforced at query level
 * 3. Carrier eligibility verified before showing loads
 * 4. Bid states properly managed with auto-close on acceptance
 * 5. Invoice unlocked ONLY after CARRIER_FINALIZED (awarded state)
 */

// ============================================================================
// STATE TRANSITION VALIDATION
// ============================================================================

export function canTransitionTo(currentStatus: LoadStatus, newStatus: LoadStatus): boolean {
  const allowedTransitions = validStateTransitions[currentStatus];
  return allowedTransitions?.includes(newStatus) ?? false;
}

export async function transitionLoadState(
  loadId: string,
  newStatus: LoadStatus,
  changedBy: string,
  note?: string
): Promise<{ success: boolean; error?: string; load?: Load }> {
  try {
    // Use storage's built-in transition which validates and logs
    const updatedLoad = await storage.transitionLoadState(loadId, newStatus, changedBy, note);
    return { success: true, load: updatedLoad };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to transition load state" };
  }
}

// ============================================================================
// ROLE-BASED VISIBILITY
// ============================================================================

export async function getLoadsForRole(
  user: User
): Promise<Load[]> {
  const allLoads = await storage.getAllLoads();

  switch (user.role) {
    case "admin":
      // Admin sees ALL loads except unavailable (shippers hide those from admin/carriers)
      return allLoads.filter(load => 
        (load.status || "draft") !== "unavailable"
      );

    case "shipper":
      // Shipper sees only their own loads across the full lifecycle
      // From submission through delivery, including unavailable loads they've hidden
      const shipperVisibleStates: LoadStatus[] = [
        "pending", "priced", "posted_to_carriers", "open_for_bid", "counter_received",
        "awarded", "invoice_created", "invoice_sent", "invoice_acknowledged", "invoice_paid", 
        "in_transit", "delivered", "closed", "unavailable"
      ];
      return allLoads.filter(load => 
        load.shipperId === user.id && 
        shipperVisibleStates.includes((load.status || "draft") as LoadStatus)
      );

    case "carrier":
      // Carrier sees only eligible loads in posted/bidding states
      return getEligibleLoadsForCarrier(user, allLoads);

    case "driver": {
      const driver = await storage.getDriverByUserId(user.id);
      if (!driver) return [];
      const driverShipments = await storage.getShipmentsByDriver(driver.id);
      const loadIds = new Set(driverShipments.map((s) => s.loadId));
      return allLoads.filter((load) => loadIds.has(load.id));
    }

    default:
      return [];
  }
}

// ============================================================================
// CARRIER ELIGIBILITY FILTERS
// ============================================================================

export interface CarrierEligibilityResult {
  eligible: boolean;
  reasons: string[];
}

export async function checkCarrierEligibility(
  carrierId: string,
  load: Load
): Promise<CarrierEligibilityResult> {
  const reasons: string[] = [];
  
  const loadStatus = (load.status || "draft") as LoadStatus;
  
  // Allow assigned carrier to see their awarded/in-progress loads
  const isAssignedCarrier = load.assignedCarrierId === carrierId;
  const assignedCarrierVisibleStates: LoadStatus[] = [
    "awarded", "invoice_created", "invoice_sent", "invoice_acknowledged", "invoice_paid", "in_transit", "delivered"
  ];
  
  if (isAssignedCarrier && assignedCarrierVisibleStates.includes(loadStatus)) {
    // Assigned carrier can always see their loads in execution states
    return { eligible: true, reasons: [] };
  }

  // 0. Check load is in carrier-visible state for bidding
  // Include "counter_received" to allow simultaneous bids from multiple carriers
  // (both solo drivers and enterprise carriers can bid on the same load)
  const carrierBiddableStates: LoadStatus[] = ["posted_to_carriers", "open_for_bid", "counter_received"];
  if (!carrierBiddableStates.includes(loadStatus)) {
    reasons.push(`Load not open for bidding (status: ${loadStatus})`);
  }

  // 0b. Skip if already awarded to another carrier (ONLY for post-awarded states)
  // During bidding states (posted_to_carriers, open_for_bid, counter_received),
  // ALL carriers can still see and bid on the load even if assignedCarrierId is set
  // This enables dual marketplace simultaneous bidding
  const postAwardedStates: LoadStatus[] = ["awarded", "invoice_created", "invoice_sent", "invoice_acknowledged", "invoice_paid", "in_transit", "delivered", "closed"];
  if (load.assignedCarrierId && load.assignedCarrierId !== carrierId && postAwardedStates.includes(loadStatus)) {
    reasons.push("Load already assigned to another carrier");
  }
  
  const carrier = await storage.getUser(carrierId);
  if (!carrier) {
    return { eligible: false, reasons: ["Carrier not found"] };
  }

  // 1. Check carrier is verified - SOFT CHECK (warning only, not blocking for MVP)
  // In production, you'd make this a hard requirement
  // if (!carrier.isVerified) {
  //   reasons.push("Carrier not verified");
  // }

  // 2. Get carrier profile for additional checks
  const profile = await storage.getCarrierProfile(carrierId);
  
  if (profile) {
    // 3. Check minimum rating (if applicable) - require at least 2.0 reliability score
    const reliabilityScore = parseFloat(profile.reliabilityScore?.toString() || "0");
    if (reliabilityScore > 0 && reliabilityScore < 2.0) {
      reasons.push("Reliability score below minimum threshold");
    }

    // 4. Check service region compatibility - SOFT CHECK for MVP
    // Service zones are optional hints, not hard requirements
    // if (profile.serviceZones && profile.serviceZones.length > 0 && load.pickupCity) {
    //   const pickupRegion = extractRegion(load.pickupCity);
    //   const dropoffRegion = extractRegion(load.dropoffCity);
    //   
    //   const servesPickup = profile.serviceZones.some(zone => 
    //     zone.toLowerCase().includes(pickupRegion.toLowerCase()) ||
    //     pickupRegion.toLowerCase().includes(zone.toLowerCase())
    //   );
    //   const servesDropoff = profile.serviceZones.some(zone => 
    //     zone.toLowerCase().includes(dropoffRegion.toLowerCase()) ||
    //     dropoffRegion.toLowerCase().includes(zone.toLowerCase())
    //   );
    //   
    //   if (!servesPickup && !servesDropoff) {
    //     reasons.push("Service zone mismatch");
    //   }
    // }
  }

  // 5. Check truck type compatibility - SOFT CHECK for MVP
  // Carriers can bid even without pre-registered matching trucks
  // if (load.requiredTruckType) {
  //   const trucks = await storage.getTrucksByCarrier(carrierId);
  //   const hasMatchingTruck = trucks.some(truck => 
  //     truck.truckType === load.requiredTruckType && truck.isAvailable
  //   );
  //   if (!hasMatchingTruck) {
  //     reasons.push("No matching truck type available");
  //   }
  // }

  // 6. Check if carrier is blocked/suspended (using isVerified as proxy)
  // In a full implementation, you'd have a separate blocked/suspended flag

  // 7. Check posting mode restrictions
  if (load.adminPostMode === "invite") {
    const invitedIds = load.invitedCarrierIds || [];
    if (!invitedIds.includes(carrierId)) {
      reasons.push("Not invited to this load");
    }
  } else if (load.adminPostMode === "assign") {
    if (load.assignedCarrierId !== carrierId) {
      reasons.push("Load assigned to different carrier");
    }
  }

  return {
    eligible: reasons.length === 0,
    reasons
  };
}

function extractRegion(city: string): string {
  // Extract state/region code from city string like "Mumbai, MH" or "Delhi, DL"
  const parts = city.split(",").map(p => p.trim());
  return parts.length > 1 ? parts[parts.length - 1] : parts[0];
}

async function getEligibleLoadsForCarrier(
  carrier: User,
  allLoads: Load[]
): Promise<Load[]> {
  const eligibleLoads: Load[] = [];

  for (const load of allLoads) {
    // Check full eligibility (includes status, assignment, posting mode, and carrier checks)
    const eligibility = await checkCarrierEligibility(carrier.id, load);
    if (eligibility.eligible) {
      eligibleLoads.push(load);
    }
  }

  return eligibleLoads;
}

// ============================================================================
// BID STATE MANAGEMENT
// ============================================================================

export const bidStateTransitions: Record<BidStatus, BidStatus[]> = {
  pending: ["accepted", "rejected", "countered", "expired"],
  countered: ["accepted", "rejected", "expired"],
  accepted: [],  // Terminal state
  rejected: [],  // Terminal state
  expired: [],   // Terminal state
};

export function canTransitionBid(current: BidStatus, next: BidStatus): boolean {
  return bidStateTransitions[current]?.includes(next) ?? false;
}

export async function acceptBid(
  bidId: string,
  acceptedBy: string,
  finalPrice?: number  // Optional: the final negotiated price from counter-offers
): Promise<{ success: boolean; error?: string; bid?: Bid; shipmentId?: string; invoiceId?: string }> {
  const logPrefix = `[acceptBid:${bidId.slice(0, 8)}]`;
  console.log(`${logPrefix} Starting bid acceptance workflow...`);
  
  // =========================================================================
  // STEP 1: VALIDATE BID EXISTS AND CAN BE ACCEPTED
  // =========================================================================
  const bid = await storage.getBid(bidId);
  if (!bid) {
    console.error(`${logPrefix} Bid not found`);
    return { success: false, error: "Bid not found" };
  }

  const currentBidStatus = (bid.status || "pending") as BidStatus;
  
  // Allow acceptance from pending OR countered status
  if (currentBidStatus !== "pending" && currentBidStatus !== "countered") {
    // If already accepted, return success (idempotent)
    if (currentBidStatus === "accepted") {
      console.log(`${logPrefix} Bid already accepted, returning success (idempotent)`);
      return { success: true, bid };
    }
    console.error(`${logPrefix} Cannot accept bid in status: ${currentBidStatus}`);
    return { 
      success: false, 
      error: `Cannot accept bid in status: ${currentBidStatus}` 
    };
  }

  // =========================================================================
  // STEP 2: VALIDATE LOAD EXISTS AND IS IN VALID STATE
  // =========================================================================
  const load = await storage.getLoad(bid.loadId);
  if (!load) {
    console.error(`${logPrefix} Load not found: ${bid.loadId}`);
    return { success: false, error: "Load not found" };
  }

  const currentLoadStatus = (load.status || "draft") as LoadStatus;
  const validBiddingStates: LoadStatus[] = ["posted_to_carriers", "open_for_bid", "counter_received"];
  const alreadyAwardedStates: LoadStatus[] = ["awarded", "invoice_created", "invoice_sent"];
  
  // If already in awarded/invoice states, check if this bid is the awarded one (idempotent)
  if (alreadyAwardedStates.includes(currentLoadStatus)) {
    if (load.awardedBidId === bidId) {
      console.log(`${logPrefix} Load already awarded to this bid, returning success (idempotent)`);
      return { success: true, bid };
    } else {
      console.error(`${logPrefix} Load already awarded to different bid: ${load.awardedBidId}`);
      return { success: false, error: "Load already awarded to another carrier" };
    }
  }

  if (!validBiddingStates.includes(currentLoadStatus)) {
    console.error(`${logPrefix} Load not in biddable state: ${currentLoadStatus}`);
    return { success: false, error: `Load not open for bidding (status: ${currentLoadStatus})` };
  }

  // =========================================================================
  // STEP 3: CALCULATE FINAL ACCEPTED AMOUNT
  // =========================================================================
  // Priority: explicit finalPrice > counterAmount (if countered) > original bid amount
  const acceptedAmount = finalPrice != null 
    ? finalPrice.toString() 
    : (bid.counterAmount && currentBidStatus === "countered") 
      ? bid.counterAmount.toString() 
      : bid.amount;
  
  console.log(`${logPrefix} Accepted amount: Rs. ${parseFloat(acceptedAmount).toLocaleString("en-IN")}`);

  // Get the name of who accepted this bid for notes
  const acceptedByUser = await storage.getUser(acceptedBy);
  const acceptedByName = acceptedByUser?.companyName || acceptedByUser?.username || 'Admin';
  const acceptedDate = new Date().toLocaleDateString('en-IN', { 
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' 
  });

  // =========================================================================
  // STEP 4: UPDATE BID STATUS TO ACCEPTED
  // =========================================================================
  console.log(`${logPrefix} Step 4: Updating bid status to accepted...`);
  const updatedBid = await storage.updateBid(bidId, { 
    status: "accepted",
    amount: acceptedAmount,
    notes: `Accepted by ${acceptedByName} on ${acceptedDate} for Rs. ${parseFloat(acceptedAmount).toLocaleString("en-IN")}`
  });

  // =========================================================================
  // STEP 5: AUTO-REJECT ALL OTHER BIDS FOR THIS LOAD
  // =========================================================================
  console.log(`${logPrefix} Step 5: Auto-rejecting other bids...`);
  const otherBids = await storage.getBidsByLoad(bid.loadId);
  let rejectedCount = 0;
  for (const otherBid of otherBids) {
    if (otherBid.id !== bidId && (otherBid.status === "pending" || otherBid.status === "countered")) {
      await storage.updateBid(otherBid.id, { 
        status: "rejected",
        notes: `Auto-rejected: Another bid was accepted (${otherBid.carrierType || "enterprise"} carrier bid closed)`
      });
      rejectedCount++;
    }
  }
  console.log(`${logPrefix} Rejected ${rejectedCount} other bids`);

  // =========================================================================
  // STEP 6: TRANSITION LOAD STATE: bidding → awarded → invoice_created
  // =========================================================================
  console.log(`${logPrefix} Step 6: Transitioning load state...`);
  
  // First transition to awarded
  const awardedResult = await transitionLoadState(bid.loadId, "awarded", acceptedBy, `Bid ${bidId} accepted at Rs. ${parseFloat(acceptedAmount).toLocaleString("en-IN")}`);
  if (!awardedResult.success) {
    console.error(`${logPrefix} Failed to transition to awarded: ${awardedResult.error}`);
    // Continue anyway - the state might have already been transitioned
  }
  
  // Then transition to invoice_created
  const invoiceCreatedResult = await transitionLoadState(bid.loadId, "invoice_created", acceptedBy, `Invoice created for Rs. ${parseFloat(acceptedAmount).toLocaleString("en-IN")}`);
  if (!invoiceCreatedResult.success) {
    console.error(`${logPrefix} Failed to transition to invoice_created: ${invoiceCreatedResult.error}`);
  }

  // =========================================================================
  // STEP 7: GENERATE PICKUP ID AND UPDATE LOAD
  // =========================================================================
  console.log(`${logPrefix} Step 7: Generating pickup ID and updating load...`);
  const pickupId = await storage.generateUniquePickupId();
  
  await storage.updateLoad(bid.loadId, {
    assignedCarrierId: bid.carrierId,
    assignedTruckId: bid.truckId,
    finalPrice: acceptedAmount,
    awardedBidId: bidId,
    pickupId: pickupId,
    awardedAt: new Date(),
  });
  console.log(`${logPrefix} Load updated with pickupId: ${pickupId}, carrierId: ${bid.carrierId.slice(0, 8)}`);

  // =========================================================================
  // STEP 8: CREATE INVOICE (if not already exists)
  // =========================================================================
  console.log(`${logPrefix} Step 8: Creating invoice...`);
  let invoiceId: string | undefined;
  try {
    const existingInvoice = await storage.getInvoiceByLoad(load.id);
    if (existingInvoice) {
      invoiceId = existingInvoice.id;
      console.log(`${logPrefix} Invoice already exists: ${invoiceId.slice(0, 8)}`);
    } else {
      const invoiceNumber = await storage.generateInvoiceNumber();
      // Invoice amount should use adminFinalPrice (shipper's gross price) - not carrier bid amount
      // adminFinalPrice is the price set by admin for the shipper to pay
      // acceptedAmount is what the carrier receives (after platform margin)
      const finalAmount = load.adminFinalPrice || acceptedAmount || "0";
      
      const advancePercent = load.advancePaymentPercent || 0;
      const advanceAmount = advancePercent > 0 ? (parseFloat(finalAmount) * (advancePercent / 100)).toFixed(2) : null;
      const balanceOnDelivery = advancePercent > 0 ? (parseFloat(finalAmount) - parseFloat(advanceAmount || "0")).toFixed(2) : null;
      
      const newInvoice = await storage.createInvoice({
        invoiceNumber,
        loadId: load.id,
        shipperId: load.shipperId,
        adminId: acceptedBy,
        subtotal: finalAmount,
        fuelSurcharge: "0",
        tollCharges: "0",
        handlingFee: "0",
        insuranceFee: "0",
        discountAmount: "0",
        discountReason: null,
        taxPercent: "0",
        taxAmount: "0",
        totalAmount: finalAmount,
        advancePaymentPercent: advancePercent > 0 ? advancePercent : null,
        advancePaymentAmount: advanceAmount,
        balanceOnDelivery: balanceOnDelivery,
        paymentTerms: "Net 30",
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        notes: `Invoice generated for load ${load.id} after carrier finalization`,
        lineItems: [{
          description: `Freight services: ${load.pickupCity} to ${load.dropoffCity}`,
          quantity: 1,
          rate: finalAmount,
          amount: finalAmount
        }],
        status: "draft",
      });
      
      invoiceId = newInvoice.id;
      console.log(`${logPrefix} Invoice created: ${invoiceNumber} (${invoiceId.slice(0, 8)})`);
      
      // Link the invoice to the load
      await storage.updateLoad(bid.loadId, {
        invoiceId: newInvoice.id,
      });
    }
  } catch (invoiceError) {
    console.error(`${logPrefix} Failed to create invoice:`, invoiceError);
    // Don't fail the whole workflow - invoice can be created manually
  }

  // =========================================================================
  // STEP 9: CREATE SHIPMENT (if not already exists)
  // =========================================================================
  console.log(`${logPrefix} Step 9: Creating shipment...`);
  let shipmentId: string | undefined;
  try {
    const existingShipment = await storage.getShipmentByLoad(bid.loadId);
    if (existingShipment) {
      shipmentId = existingShipment.id;
      console.log(`${logPrefix} Shipment already exists: ${shipmentId.slice(0, 8)}`);
    } else {
      const newShipment = await storage.createShipment({
        loadId: bid.loadId,
        carrierId: bid.carrierId,
        truckId: bid.truckId || null,
        driverId: bid.driverId || null,
        status: "pickup_scheduled",
      });
      shipmentId = newShipment.id;
      console.log(`${logPrefix} Shipment created: ${shipmentId.slice(0, 8)}`);
    }
  } catch (shipmentError) {
    console.error(`${logPrefix} Failed to create shipment:`, shipmentError);
    // Don't fail the whole workflow - shipment can be created manually
  }

  // =========================================================================
  // STEP 10: BROADCAST REAL-TIME UPDATES
  // =========================================================================
  console.log(`${logPrefix} Step 10: Broadcasting updates...`);
  broadcastBidAccepted(bid.carrierId, load.id, {
    id: bidId,
    amount: acceptedAmount,
    loadId: load.id,
  });

  broadcastLoadUpdated(load.id, load.shipperId, "invoice_created", "invoice_created", {
    id: load.id,
    status: "invoice_created",
    pickupCity: load.pickupCity,
    dropoffCity: load.dropoffCity,
  });

  console.log(`${logPrefix} Bid acceptance workflow completed successfully!`);
  return { success: true, bid: updatedBid, shipmentId, invoiceId };
}

export async function rejectBid(
  bidId: string,
  rejectedBy: string,
  reason?: string
): Promise<{ success: boolean; error?: string; bid?: Bid }> {
  const bid = await storage.getBid(bidId);
  if (!bid) {
    return { success: false, error: "Bid not found" };
  }

  const currentStatus = (bid.status || "pending") as BidStatus;
  if (!canTransitionBid(currentStatus, "rejected")) {
    return { 
      success: false, 
      error: `Cannot reject bid in status: ${currentStatus}` 
    };
  }

  const updatedBid = await storage.updateBid(bidId, { 
    status: "rejected",
    notes: reason || `Rejected by ${rejectedBy}`
  });

  broadcastBidRejected(bid.carrierId, bid.loadId, {
    id: bidId,
    amount: bid.amount,
    reason: reason || "Bid rejected",
  });

  return { success: true, bid: updatedBid };
}

export async function counterBid(
  bidId: string,
  newAmount: string,
  counteredBy: string,
  notes?: string
): Promise<{ success: boolean; error?: string; bid?: Bid }> {
  const bid = await storage.getBid(bidId);
  if (!bid) {
    return { success: false, error: "Bid not found" };
  }

  const currentStatus = (bid.status || "pending") as BidStatus;
  if (!canTransitionBid(currentStatus, "countered")) {
    return { 
      success: false, 
      error: `Cannot counter bid in status: ${currentStatus}` 
    };
  }

  const updatedBid = await storage.updateBid(bidId, { 
    status: "countered",
    counterAmount: newAmount,
    notes: notes || `Counter offer: ${newAmount} by ${counteredBy}`
  });

  // Update load to counter_received state
  const load = await storage.getLoad(bid.loadId);
  if (load) {
    await transitionLoadState(bid.loadId, "counter_received", counteredBy, `Counter bid on ${bidId}`);
  }

  return { success: true, bid: updatedBid };
}

// ============================================================================
// VISIBILITY HELPERS FOR API ROUTES
// ============================================================================

export async function canUserAccessLoad(userId: string, loadId: string): Promise<boolean> {
  const user = await storage.getUser(userId);
  if (!user) return false;

  const load = await storage.getLoad(loadId);
  if (!load) return false;

  switch (user.role) {
    case "admin":
      return true;
    case "shipper":
      return load.shipperId === user.id;
    case "carrier":
      const eligibility = await checkCarrierEligibility(user.id, load);
      return eligibility.eligible || load.assignedCarrierId === user.id;
    default:
      return false;
  }
}

export async function canUserBidOnLoad(userId: string, loadId: string): Promise<{ allowed: boolean; reason?: string }> {
  const user = await storage.getUser(userId);
  if (!user) {
    return { allowed: false, reason: "User not found" };
  }

  if (user.role !== "carrier") {
    return { allowed: false, reason: "Only carriers can bid" };
  }

  const load = await storage.getLoad(loadId);
  if (!load) {
    return { allowed: false, reason: "Load not found" };
  }

  // Check load is in biddable state
  // Include "counter_received" to allow simultaneous bids from multiple carriers
  const biddableStates: LoadStatus[] = ["posted_to_carriers", "open_for_bid", "counter_received"];
  if (!biddableStates.includes((load.status || "draft") as LoadStatus)) {
    return { allowed: false, reason: `Load not open for bidding (status: ${load.status})` };
  }

  // Check carrier eligibility
  const eligibility = await checkCarrierEligibility(user.id, load);
  if (!eligibility.eligible) {
    return { allowed: false, reason: eligibility.reasons.join(", ") };
  }

  // Check if carrier already has an active bid
  const existingBids = await storage.getBidsByLoad(loadId);
  const carrierBid = existingBids.find(b => b.carrierId === userId && b.status === "pending");
  if (carrierBid) {
    return { allowed: false, reason: "You already have a pending bid on this load" };
  }

  // Check document compliance
  const compliance = await checkCarrierDocumentCompliance(userId);
  if (!compliance.compliant) {
    return { allowed: false, reason: compliance.reason || "Document compliance check failed" };
  }

  return { allowed: true };
}

// ============================================================================
// DOCUMENT COMPLIANCE CHECK
// ============================================================================

export interface DocumentComplianceResult {
  compliant: boolean;
  reason?: string;
  expiredDocuments: string[];
  missingDocuments: string[];
}

const REQUIRED_DOCUMENT_TYPES = [
  "driving_license",
  "rc",
  "insurance",
  "permit",
  "fitness",
  "puc"
];

const DOCUMENT_DISPLAY_NAMES: Record<string, string> = {
  "driving_license": "Driving License",
  "rc": "Registration Certificate (RC)",
  "insurance": "Insurance",
  "permit": "Permit",
  "fitness": "Fitness Certificate",
  "puc": "PUC Certificate"
};

export async function checkCarrierDocumentCompliance(
  carrierId: string
): Promise<DocumentComplianceResult> {
  const now = new Date();
  const expiredDocuments: string[] = [];
  const missingDocuments: string[] = [];

  // Get carrier profile to check if solo or enterprise
  const profile = await storage.getCarrierProfile(carrierId);
  const isSolo = profile?.carrierType === "solo";

  // Get all documents for this carrier
  const documents = await storage.getDocumentsByUser(carrierId);
  
  // For solo carriers, we check all documents under their user ID
  // For enterprise carriers, we check company-level documents
  for (const docType of REQUIRED_DOCUMENT_TYPES) {
    const doc = documents.find(d => d.documentType === docType && d.isVerified === true);
    
    if (!doc) {
      // Document not found or not verified - mark as missing
      missingDocuments.push(DOCUMENT_DISPLAY_NAMES[docType] || docType);
    } else if (doc.expiryDate && new Date(doc.expiryDate) < now) {
      // Document expired
      expiredDocuments.push(DOCUMENT_DISPLAY_NAMES[docType] || docType);
    }
  }

  // Build reason message
  let reason: string | undefined;
  
  if (expiredDocuments.length > 0) {
    reason = `Expired documents: ${expiredDocuments.join(", ")}. Please renew before bidding.`;
  }
  
  // Note: For MVP, we only block on expired docs, not missing docs (carriers can still be onboarding)
  // To also block on missing docs, uncomment below:
  // if (missingDocuments.length > 0) {
  //   const missingMsg = `Missing documents: ${missingDocuments.join(", ")}.`;
  //   reason = reason ? `${reason} ${missingMsg}` : missingMsg;
  // }

  return {
    compliant: expiredDocuments.length === 0,
    reason,
    expiredDocuments,
    missingDocuments
  };
}
