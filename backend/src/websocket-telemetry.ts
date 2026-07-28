import { WebSocketServer, WebSocket } from "ws";
import type { Server, IncomingMessage } from "http";
import type { Socket } from "net";
import {
  startTelemetrySimulation,
  getAllVehiclesTelemetry,
  getVehicleTelemetry,
  getEtaPrediction,
  getGpsBreadcrumbs,
  getDriverBehaviorScore,
  checkTelemetryAlerts,
  getActiveVehicleIds,
} from "./telemetry-simulator";

interface TelemetryClient {
  ws: WebSocket;
  subscribedVehicles: Set<string>;
  subscribedLoads: Set<string>;
  subscribeAll: boolean;
}

const clients: Map<WebSocket, TelemetryClient> = new Map();

export function setupTelemetryWebSocket(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  // Use request.url directly (path + query). Avoid new URL(...) — behind proxies/ALB
  // host or malformed URLs can make parsing unreliable; raw url is what Node passes to upgrade.
  server.on("upgrade", (request: IncomingMessage, socket: Socket, head: Buffer) => {
    const url = request.url ?? "";
    if (url.startsWith("/ws/telemetry")) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } else if (url.startsWith("/ws/marketplace")) {
      // Registered before this listener; do not touch socket.
      return;
    } else {
      socket.destroy();
    }
  });

  // Start the telemetry simulation
  startTelemetrySimulation();

  wss.on("connection", (ws: WebSocket) => {
    console.log("Telemetry WebSocket client connected");

    // Initialize client
    const client: TelemetryClient = {
      ws,
      subscribedVehicles: new Set(),
      subscribedLoads: new Set(),
      subscribeAll: false,
    };
    clients.set(ws, client);

    // Send initial connection message
    ws.send(JSON.stringify({
      type: "connected",
      message: "Connected to telemetry stream",
      availableVehicles: getActiveVehicleIds(),
      timestamp: new Date().toISOString(),
    }));

    // Handle incoming messages
    ws.on("message", (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        handleClientMessage(client, message);
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    });

    // Handle disconnection
    ws.on("close", () => {
      console.log("Telemetry WebSocket client disconnected");
      clients.delete(ws);
    });

    ws.on("error", (error) => {
      console.error("WebSocket error:", error);
      clients.delete(ws);
    });
  });

  // Start broadcasting telemetry data
  setInterval(() => {
    broadcastTelemetry();
  }, 5000); // Every 5 seconds

  console.log("Telemetry WebSocket server started on /ws/telemetry");
  return wss;
}

function handleClientMessage(client: TelemetryClient, message: any): void {
  switch (message.type) {
    case "subscribe":
      if (message.vehicleId) {
        client.subscribedVehicles.add(message.vehicleId);
        // Send immediate telemetry for this vehicle
        const telemetry = getVehicleTelemetry(message.vehicleId);
        if (telemetry) {
          sendToClient(client.ws, {
            type: "telemetry",
            data: telemetry,
            timestamp: new Date().toISOString(),
          });
        }
      }
      if (message.loadId) {
        client.subscribedLoads.add(message.loadId);
        // Send ETA prediction for this load
        const eta = getEtaPrediction(message.loadId);
        if (eta) {
          sendToClient(client.ws, {
            type: "eta_prediction",
            data: eta,
            timestamp: new Date().toISOString(),
          });
        }
      }
      if (message.all) {
        client.subscribeAll = true;
        // Send all telemetry immediately
        const allTelemetry = getAllVehiclesTelemetry();
        sendToClient(client.ws, {
          type: "telemetry_all",
          data: allTelemetry,
          timestamp: new Date().toISOString(),
        });
      }
      break;

    case "unsubscribe":
      if (message.vehicleId) {
        client.subscribedVehicles.delete(message.vehicleId);
      }
      if (message.loadId) {
        client.subscribedLoads.delete(message.loadId);
      }
      if (message.all) {
        client.subscribeAll = false;
      }
      break;

    case "get_breadcrumbs":
      if (message.vehicleId) {
        const breadcrumbs = getGpsBreadcrumbs(message.vehicleId, message.minutes || 10);
        sendToClient(client.ws, {
          type: "breadcrumbs",
          vehicleId: message.vehicleId,
          data: breadcrumbs,
          timestamp: new Date().toISOString(),
        });
      }
      break;

    case "get_driver_behavior":
      if (message.driverId) {
        const behavior = getDriverBehaviorScore(message.driverId);
        sendToClient(client.ws, {
          type: "driver_behavior",
          driverId: message.driverId,
          data: behavior,
          timestamp: new Date().toISOString(),
        });
      }
      break;

    case "get_eta":
      if (message.loadId) {
        const eta = getEtaPrediction(message.loadId);
        sendToClient(client.ws, {
          type: "eta_prediction",
          loadId: message.loadId,
          data: eta,
          timestamp: new Date().toISOString(),
        });
      }
      break;

    case "ping":
      sendToClient(client.ws, {
        type: "pong",
        timestamp: new Date().toISOString(),
      });
      break;

    default:
      console.log("Unknown message type:", message.type);
  }
}

function sendToClient(ws: WebSocket, data: any): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function broadcastTelemetry(): void {
  const allTelemetry = getAllVehiclesTelemetry();
  const alertsByVehicle: Map<string, string[]> = new Map();

  // Check for alerts
  allTelemetry.forEach(telemetry => {
    const alerts = checkTelemetryAlerts(telemetry);
    if (alerts.length > 0) {
      alertsByVehicle.set(telemetry.vehicleId, alerts);
    }
  });

  clients.forEach((client, ws) => {
    if (ws.readyState !== WebSocket.OPEN) return;

    // Send to subscribers of all vehicles
    if (client.subscribeAll) {
      sendToClient(ws, {
        type: "telemetry_all",
        data: allTelemetry,
        timestamp: new Date().toISOString(),
      });
    }

    // Send to specific vehicle subscribers
    client.subscribedVehicles.forEach(vehicleId => {
      const telemetry = getVehicleTelemetry(vehicleId);
      if (telemetry) {
        sendToClient(ws, {
          type: "telemetry",
          data: telemetry,
          timestamp: new Date().toISOString(),
        });

        // Send alerts for this vehicle
        const alerts = alertsByVehicle.get(vehicleId);
        if (alerts && alerts.length > 0) {
          sendToClient(ws, {
            type: "alerts",
            vehicleId,
            data: alerts,
            timestamp: new Date().toISOString(),
          });
        }
      }
    });

    // Send ETA predictions for subscribed loads
    client.subscribedLoads.forEach(loadId => {
      const eta = getEtaPrediction(loadId);
      if (eta) {
        sendToClient(ws, {
          type: "eta_prediction",
          data: eta,
          timestamp: new Date().toISOString(),
        });
      }
    });
  });

  // Broadcast alerts to all clients
  if (alertsByVehicle.size > 0) {
    const alertsArray: { vehicleId: string; alerts: string[] }[] = [];
    alertsByVehicle.forEach((alerts, vehicleId) => {
      alertsArray.push({ vehicleId, alerts });
    });

    clients.forEach((client, ws) => {
      if (ws.readyState === WebSocket.OPEN && client.subscribeAll) {
        sendToClient(ws, {
          type: "alerts_all",
          data: alertsArray,
          timestamp: new Date().toISOString(),
        });
      }
    });
  }
}
