import { WebSocketServer, WebSocket } from "ws";
import type { Server, IncomingMessage } from "http";
import type { Socket } from "net";

interface MarketplaceClient {
  ws: WebSocket;
  role: "carrier" | "admin" | "shipper" | null;
  userId: string | null;
  isAlive: boolean;
}

const clients: Map<WebSocket, MarketplaceClient> = new Map();
let wss: WebSocketServer | null = null;

export function setupMarketplaceWebSocket(server: Server): WebSocketServer {
  wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request: IncomingMessage, socket: Socket, head: Buffer) => {
    const url = request.url ?? "";
    if (url.startsWith("/ws/marketplace")) {
      wss!.handleUpgrade(request, socket, head, (ws) => {
        wss!.emit("connection", ws, request);
      });
    }
  });

  wss.on("connection", (ws: WebSocket) => {
    console.log("Marketplace WebSocket client connected");

    const client: MarketplaceClient = {
      ws,
      role: null,
      userId: null,
      isAlive: true,
    };
    clients.set(ws, client);

    ws.on("pong", () => {
      const c = clients.get(ws);
      if (c) c.isAlive = true;
    });

    ws.send(JSON.stringify({
      type: "connected",
      message: "Connected to marketplace events",
      timestamp: new Date().toISOString(),
    }));

    ws.on("message", (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        handleClientMessage(client, message);
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    });

    ws.on("close", () => {
      console.log("Marketplace WebSocket client disconnected");
      clients.delete(ws);
    });

    ws.on("error", (error) => {
      console.error("Marketplace WebSocket error:", error);
      // Cleanup is handled by the subsequent "close" event
    });
  });

  // Heartbeat: ping every 30s so ALB doesn't drop idle connections.
  // Clients that miss a full cycle (did not respond with pong) are terminated.
  const heartbeatInterval = setInterval(() => {
    clients.forEach((client, ws) => {
      if (!client.isAlive) {
        console.log("Terminating unresponsive marketplace connection");
        clients.delete(ws);
        ws.terminate();
        return;
      }
      client.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on("close", () => clearInterval(heartbeatInterval));

  console.log("Marketplace WebSocket server started on /ws/marketplace");
  return wss;
}

function handleClientMessage(client: MarketplaceClient, message: any): void {
  switch (message.type) {
    case "identify":
      client.role = message.role || null;
      client.userId = message.userId || null;
      sendToClient(client.ws, {
        type: "identified",
        role: client.role,
        timestamp: new Date().toISOString(),
      });
      break;

    case "ping":
      sendToClient(client.ws, {
        type: "pong",
        timestamp: new Date().toISOString(),
      });
      break;

    default:
      console.log("Unknown marketplace message type:", message.type);
  }
}

function sendToClient(ws: WebSocket, data: any): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

export function broadcastLoadPosted(loadData: {
  id: string;
  pickupCity: string | null;
  dropoffCity: string | null;
  adminFinalPrice: string | null;
  requiredTruckType: string | null;
  status: string | null;
}): void {
  const message = {
    type: "load_posted",
    load: loadData,
    timestamp: new Date().toISOString(),
  };

  clients.forEach((client, ws) => {
    if (ws.readyState === WebSocket.OPEN && client.role === "carrier") {
      sendToClient(ws, message);
    }
  });

  console.log(`Broadcasted load_posted event for load ${loadData.id} to ${clients.size} carrier clients`);
}

export function broadcastLoadSubmitted(loadData: {
  id: string;
  pickupCity: string | null;
  dropoffCity: string | null;
  shipperId: string;
  shipperName?: string;
  status: string | null;
}): void {
  const message = {
    type: "load_submitted",
    load: loadData,
    timestamp: new Date().toISOString(),
  };

  let adminCount = 0;
  clients.forEach((client, ws) => {
    if (ws.readyState === WebSocket.OPEN && client.role === "admin") {
      sendToClient(ws, message);
      adminCount++;
    }
  });

  console.log(`Broadcasted load_submitted event for load ${loadData.id} to ${adminCount} admin clients`);
}

export function broadcastLoadUpdated(loadId: string, shipperId: string | null, status: string | null, event: string, loadData?: any): void {
  const message = {
    type: "load_updated",
    loadId,
    status,
    event,
    load: loadData,
    timestamp: new Date().toISOString(),
  };

  clients.forEach((client, ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      if (client.role === "admin") {
        sendToClient(ws, message);
      }
      if (client.role === "shipper" && shipperId && client.userId === shipperId) {
        sendToClient(ws, message);
      }
    }
  });
  console.log(`Broadcasted load_updated (${event}) for load ${loadId}`);
}

export function broadcastBidReceived(loadId: string, bidData: any): void {
  const message = {
    type: "bid_received",
    loadId,
    bid: bidData,
    timestamp: new Date().toISOString(),
  };

  clients.forEach((client, ws) => {
    if (ws.readyState === WebSocket.OPEN && client.role === "admin") {
      sendToClient(ws, message);
    }
  });
  console.log(`Broadcasted bid_received event for load ${loadId}`);
}

export function broadcastBidCountered(carrierId: string, loadId: string, bidData: any): void {
  const message = {
    type: "bid_countered",
    loadId,
    bid: bidData,
    timestamp: new Date().toISOString(),
  };

  clients.forEach((client, ws) => {
    if (ws.readyState === WebSocket.OPEN && client.role === "carrier" && client.userId === carrierId) {
      sendToClient(ws, message);
    }
  });
  console.log(`Broadcasted bid_countered event to carrier ${carrierId}`);
}

export function broadcastBidAccepted(carrierId: string, loadId: string, bidData: any): void {
  const message = {
    type: "bid_accepted",
    loadId,
    bid: bidData,
    timestamp: new Date().toISOString(),
  };

  clients.forEach((client, ws) => {
    if (ws.readyState === WebSocket.OPEN && client.role === "carrier" && client.userId === carrierId) {
      sendToClient(ws, message);
    }
  });
  console.log(`Broadcasted bid_accepted event to carrier ${carrierId}`);
}

export function broadcastBidRejected(carrierId: string, loadId: string, bidData: any): void {
  const message = {
    type: "bid_rejected",
    loadId,
    carrierId,
    bid: bidData,
    timestamp: new Date().toISOString(),
  };

  clients.forEach((client, ws) => {
    if (ws.readyState === WebSocket.OPEN && client.role === "carrier" && client.userId === carrierId) {
      sendToClient(ws, message);
    }
  });
  console.log(`Broadcasted bid_rejected event to carrier ${carrierId}`);
}

export function broadcastInvoiceEvent(shipperId: string, invoiceId: string, event: string, invoiceData?: any): void {
  const message = {
    type: "invoice_update",
    invoiceId,
    event,
    invoice: invoiceData,
    timestamp: new Date().toISOString(),
  };

  let sentToShipper = false;
  clients.forEach((client, ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      // Send invoice_sent to shipper
      if (event === "invoice_sent" && client.role === "shipper" && client.userId === shipperId) {
        console.log(`[WS] Sending invoice_sent to shipper ${shipperId} (connected as ${client.userId})`);
        sendToClient(ws, message);
        sentToShipper = true;
      }
      // Send all shipper activity events to admin for real-time tracking
      if (["invoice_viewed", "invoice_opened", "invoice_acknowledged", "invoice_paid", "invoice_countered"].includes(event) && client.role === "admin") {
        sendToClient(ws, message);
      }
    }
  });
  if (event === "invoice_sent" && !sentToShipper) {
    console.log(`[WS] Shipper ${shipperId} not connected - invoice_sent event will be seen on page refresh`);
  }
  console.log(`Broadcasted invoice_${event} event for invoice ${invoiceId}`);
}

export function broadcastNegotiationMessage(targetRole: "carrier" | "admin", targetUserId: string | null, bidId: string, messageData: any): void {
  const message = {
    type: "negotiation_message",
    bidId,
    negotiation: messageData,
    timestamp: new Date().toISOString(),
  };

  clients.forEach((client, ws) => {
    if (ws.readyState === WebSocket.OPEN && client.role === targetRole) {
      if (targetUserId === null || client.userId === targetUserId) {
        sendToClient(ws, message);
      }
    }
  });
  console.log(`Broadcasted negotiation_message to ${targetRole}`);
}

export function broadcastVerificationStatus(carrierId: string, status: "approved" | "rejected" | "on_hold", data: {
  companyName?: string;
  reason?: string;
}): void {
  const message = {
    type: "verification_status_changed",
    carrierId,
    status,
    companyName: data.companyName,
    reason: data.reason,
    timestamp: new Date().toISOString(),
  };

  clients.forEach((client, ws) => {
    if (ws.readyState === WebSocket.OPEN && client.role === "carrier" && client.userId === carrierId) {
      sendToClient(ws, message);
    }
  });
  console.log(`Broadcasted verification_status_changed (${status}) to carrier ${carrierId}`);
}

// Generic marketplace event broadcast to all admin users
export function broadcastMarketplaceEvent(eventType: string, data: any): void {
  const message = {
    type: eventType,
    data,
    timestamp: new Date().toISOString(),
  };

  clients.forEach((client, ws) => {
    if (ws.readyState === WebSocket.OPEN && client.role === "admin") {
      sendToClient(ws, message);
    }
  });
  console.log(`Broadcasted ${eventType} event to admin clients`);
}

// Broadcast event to a specific user by userId
export function broadcastToUser(userId: string, data: any): void {
  const message = {
    ...data,
    timestamp: new Date().toISOString(),
  };

  let sentCount = 0;
  clients.forEach((client, ws) => {
    if (ws.readyState === WebSocket.OPEN && client.userId === userId) {
      sendToClient(ws, message);
      sentCount++;
    }
  });
  console.log(`Broadcasted ${data.type || 'event'} to user ${userId} (${sentCount} connections)`);
}

// Broadcast new rating received to carrier
export function broadcastRatingReceived(carrierId: string, ratingData: {
  rating: number;
  review?: string;
  shipperName?: string;
  averageRating: number;
  totalRatings: number;
  badgeLevel?: string;
  qualifyingRatingsCount?: number;
}): void {
  const message = {
    type: "rating_received",
    carrierId,
    rating: ratingData.rating,
    review: ratingData.review,
    shipperName: ratingData.shipperName,
    averageRating: ratingData.averageRating,
    totalRatings: ratingData.totalRatings,
    badgeLevel: ratingData.badgeLevel,
    qualifyingRatingsCount: ratingData.qualifyingRatingsCount,
    timestamp: new Date().toISOString(),
  };

  let sentCount = 0;
  clients.forEach((client, ws) => {
    if (ws.readyState === WebSocket.OPEN && client.role === "carrier" && client.userId === carrierId) {
      sendToClient(ws, message);
      sentCount++;
    }
  });
  console.log(`Broadcasted rating_received to carrier ${carrierId} (${sentCount} connections)`);
}
