import type { LiveTelemetryData, EtaPrediction } from "@shared/schema";

// Simulated vehicle routes (coordinates for realistic movement)
const routes = {
  "route-1": {
    start: { lat: 28.6139, lng: 77.2090 }, // Delhi
    end: { lat: 19.0760, lng: 72.8777 }, // Mumbai
    waypoints: [
      { lat: 28.4595, lng: 77.0266 },
      { lat: 27.1767, lng: 78.0081 },
      { lat: 26.8467, lng: 75.7333 },
      { lat: 24.5854, lng: 73.7125 },
      { lat: 23.2599, lng: 72.6311 },
      { lat: 22.3072, lng: 73.1812 },
      { lat: 21.1702, lng: 72.8311 },
      { lat: 19.9975, lng: 73.7898 },
      { lat: 19.0760, lng: 72.8777 },
    ],
    totalDistance: 1400,
  },
  "route-2": {
    start: { lat: 12.9716, lng: 77.5946 }, // Bangalore
    end: { lat: 13.0827, lng: 80.2707 }, // Chennai
    waypoints: [
      { lat: 12.9716, lng: 77.5946 },
      { lat: 12.8406, lng: 78.3894 },
      { lat: 12.5266, lng: 78.9549 },
      { lat: 12.5937, lng: 79.5444 },
      { lat: 12.7409, lng: 79.9193 },
      { lat: 13.0827, lng: 80.2707 },
    ],
    totalDistance: 350,
  },
  "route-3": {
    start: { lat: 22.5726, lng: 88.3639 }, // Kolkata
    end: { lat: 28.6139, lng: 77.2090 }, // Delhi
    waypoints: [
      { lat: 22.5726, lng: 88.3639 },
      { lat: 23.3441, lng: 85.3096 },
      { lat: 25.0961, lng: 85.3131 },
      { lat: 25.5941, lng: 85.1376 },
      { lat: 26.4499, lng: 80.3319 },
      { lat: 27.1767, lng: 78.0081 },
      { lat: 28.6139, lng: 77.2090 },
    ],
    totalDistance: 1500,
  },
};

// Active vehicle simulations
interface VehicleSimulation {
  vehicleId: string;
  driverId: string;
  loadId: string;
  routeId: string;
  currentWaypointIndex: number;
  progress: number; // 0-1 between waypoints
  speed: number;
  rpm: number;
  fuelLevel: number;
  engineTemp: number;
  batteryVoltage: number;
  odometer: number;
  loadWeight: number;
  maxCapacity: number;
  heading: number;
  isIgnitionOn: boolean;
  lastUpdate: Date;
  behaviorEvents: { type: string; timestamp: Date }[];
}

const activeVehicles: Map<string, VehicleSimulation> = new Map();

// Initialize some demo vehicles
function initializeDemoVehicles() {
  const demoVehicles: VehicleSimulation[] = [
    {
      vehicleId: "TRK-1024",
      driverId: "DRV-554",
      loadId: "LD-883",
      routeId: "route-1",
      currentWaypointIndex: 0,
      progress: 0.3,
      speed: 62,
      rpm: 1800,
      fuelLevel: 68,
      engineTemp: 92,
      batteryVoltage: 13.7,
      odometer: 152344.8,
      loadWeight: 18.5,
      maxCapacity: 25,
      heading: 215,
      isIgnitionOn: true,
      lastUpdate: new Date(),
      behaviorEvents: [],
    },
    {
      vehicleId: "TRK-2048",
      driverId: "DRV-221",
      loadId: "LD-556",
      routeId: "route-2",
      currentWaypointIndex: 1,
      progress: 0.6,
      speed: 55,
      rpm: 1650,
      fuelLevel: 82,
      engineTemp: 88,
      batteryVoltage: 14.1,
      odometer: 89234.2,
      loadWeight: 12.3,
      maxCapacity: 20,
      heading: 145,
      isIgnitionOn: true,
      lastUpdate: new Date(),
      behaviorEvents: [],
    },
    {
      vehicleId: "TRK-3072",
      driverId: "DRV-889",
      loadId: "LD-442",
      routeId: "route-3",
      currentWaypointIndex: 2,
      progress: 0.1,
      speed: 48,
      rpm: 1450,
      fuelLevel: 45,
      engineTemp: 95,
      batteryVoltage: 12.9,
      odometer: 234567.1,
      loadWeight: 22.1,
      maxCapacity: 25,
      heading: 280,
      isIgnitionOn: true,
      lastUpdate: new Date(),
      behaviorEvents: [],
    },
    {
      vehicleId: "TRK-4096",
      driverId: "DRV-123",
      loadId: "LD-771",
      routeId: "route-1",
      currentWaypointIndex: 4,
      progress: 0.8,
      speed: 70,
      rpm: 2100,
      fuelLevel: 35,
      engineTemp: 102,
      batteryVoltage: 13.2,
      odometer: 67891.5,
      loadWeight: 15.0,
      maxCapacity: 20,
      heading: 195,
      isIgnitionOn: true,
      lastUpdate: new Date(),
      behaviorEvents: [],
    },
    {
      vehicleId: "TRK-5120",
      driverId: "DRV-456",
      loadId: "LD-998",
      routeId: "route-2",
      currentWaypointIndex: 3,
      progress: 0.4,
      speed: 0,
      rpm: 800,
      fuelLevel: 8,
      engineTemp: 75,
      batteryVoltage: 11.8,
      odometer: 312456.9,
      loadWeight: 10.5,
      maxCapacity: 15,
      heading: 90,
      isIgnitionOn: true,
      lastUpdate: new Date(),
      behaviorEvents: [],
    },
  ];

  demoVehicles.forEach(v => activeVehicles.set(v.vehicleId, v));
}

// Calculate interpolated position between waypoints
function interpolatePosition(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
  progress: number
): { lat: number; lng: number } {
  return {
    lat: start.lat + (end.lat - start.lat) * progress,
    lng: start.lng + (end.lng - start.lng) * progress,
  };
}

// Calculate heading between two points
function calculateHeading(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): number {
  const dLng = to.lng - from.lng;
  const y = Math.sin(dLng) * Math.cos(to.lat);
  const x = Math.cos(from.lat) * Math.sin(to.lat) - Math.sin(from.lat) * Math.cos(to.lat) * Math.cos(dLng);
  let heading = Math.atan2(y, x) * (180 / Math.PI);
  heading = (heading + 360) % 360;
  return Math.round(heading);
}

// Update vehicle simulation state
function updateVehicleState(vehicle: VehicleSimulation): void {
  const route = routes[vehicle.routeId as keyof typeof routes];
  if (!route) return;

  const now = new Date();
  const timeDelta = (now.getTime() - vehicle.lastUpdate.getTime()) / 1000;
  vehicle.lastUpdate = now;

  if (!vehicle.isIgnitionOn) return;

  // Update position based on speed
  const distanceCovered = (vehicle.speed / 3600) * timeDelta; // km in this time period
  const waypointDistance = route.totalDistance / route.waypoints.length;
  const progressIncrement = distanceCovered / waypointDistance;

  vehicle.progress += progressIncrement;

  // Move to next waypoint if needed
  if (vehicle.progress >= 1) {
    vehicle.progress = 0;
    vehicle.currentWaypointIndex++;
    if (vehicle.currentWaypointIndex >= route.waypoints.length - 1) {
      vehicle.currentWaypointIndex = 0; // Loop back
    }
  }

  // Update speed with some variation
  const speedVariation = (Math.random() - 0.5) * 5;
  vehicle.speed = Math.max(0, Math.min(120, vehicle.speed + speedVariation));

  // Update RPM based on speed
  vehicle.rpm = Math.round(800 + (vehicle.speed / 120) * 2500);

  // Update fuel level (decreasing slowly)
  vehicle.fuelLevel = Math.max(0, vehicle.fuelLevel - 0.001 * timeDelta * (vehicle.speed / 60));

  // Update engine temperature with variation
  const tempVariation = (Math.random() - 0.5) * 2;
  vehicle.engineTemp = Math.max(70, Math.min(115, vehicle.engineTemp + tempVariation));

  // Update battery voltage
  vehicle.batteryVoltage = 12.5 + Math.random() * 2;

  // Update odometer
  vehicle.odometer += distanceCovered;

  // Calculate current heading
  const currentWaypoint = route.waypoints[vehicle.currentWaypointIndex];
  const nextWaypoint = route.waypoints[vehicle.currentWaypointIndex + 1] || route.waypoints[0];
  vehicle.heading = calculateHeading(currentWaypoint, nextWaypoint);

  // Simulate random driver behavior events (rare)
  if (Math.random() < 0.001) {
    const eventTypes = ["harsh_brake", "sudden_acceleration", "overspeed"];
    const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
    vehicle.behaviorEvents.push({ type: eventType, timestamp: now });
  }
}

// Get current telemetry data for a vehicle
export function getVehicleTelemetry(vehicleId: string): LiveTelemetryData | null {
  const vehicle = activeVehicles.get(vehicleId);
  if (!vehicle) return null;

  const route = routes[vehicle.routeId as keyof typeof routes];
  if (!route) return null;

  const currentWaypoint = route.waypoints[vehicle.currentWaypointIndex];
  const nextWaypoint = route.waypoints[vehicle.currentWaypointIndex + 1] || route.waypoints[0];
  const position = interpolatePosition(currentWaypoint, nextWaypoint, vehicle.progress);

  return {
    vehicleId: vehicle.vehicleId,
    gps: position,
    speed: Math.round(vehicle.speed),
    rpm: vehicle.rpm,
    fuelLevel: Math.round(vehicle.fuelLevel),
    engineTemp: Math.round(vehicle.engineTemp),
    batteryVoltage: Math.round(vehicle.batteryVoltage * 10) / 10,
    odometer: Math.round(vehicle.odometer * 10) / 10,
    driverId: vehicle.driverId,
    loadId: vehicle.loadId,
    heading: vehicle.heading,
    loadWeight: vehicle.loadWeight,
    maxCapacity: vehicle.maxCapacity,
    isIgnitionOn: vehicle.isIgnitionOn,
    timestamp: new Date().toISOString(),
  };
}

// Get all active vehicles telemetry
export function getAllVehiclesTelemetry(): LiveTelemetryData[] {
  const telemetryData: LiveTelemetryData[] = [];
  activeVehicles.forEach((_, vehicleId) => {
    const data = getVehicleTelemetry(vehicleId);
    if (data) telemetryData.push(data);
  });
  return telemetryData;
}

// Get ETA prediction for a load
export function getEtaPrediction(loadId: string): EtaPrediction | null {
  // Find vehicle with this load
  let vehicle: VehicleSimulation | undefined;
  activeVehicles.forEach(v => {
    if (v.loadId === loadId) vehicle = v;
  });

  if (!vehicle) return null;

  const route = routes[vehicle.routeId as keyof typeof routes];
  if (!route) return null;

  // Calculate remaining distance
  const waypointsRemaining = route.waypoints.length - vehicle.currentWaypointIndex - 1;
  const waypointDistance = route.totalDistance / route.waypoints.length;
  const distanceRemaining = (waypointsRemaining - vehicle.progress + 1) * waypointDistance;

  // Calculate ETA based on current speed
  const avgSpeed = vehicle.speed || 50;
  const hoursRemaining = distanceRemaining / avgSpeed;
  const minutesRemaining = hoursRemaining * 60;

  const currentEta = new Date(Date.now() + minutesRemaining * 60 * 1000);
  const originalEta = new Date(Date.now() + minutesRemaining * 60 * 1000 - 15 * 60 * 1000); // 15 min earlier original

  // Simulate traffic and weather conditions
  const trafficConditions = ["clear", "moderate", "heavy"];
  const weatherConditions = ["clear", "cloudy", "rain", "fog"];
  const trafficCondition = trafficConditions[Math.floor(Math.random() * trafficConditions.length)];
  const weatherCondition = weatherConditions[Math.floor(Math.random() * weatherConditions.length)];

  // Calculate delay risk
  let delayMinutes = 0;
  let delayRisk: "low" | "medium" | "high" = "low";
  if (trafficCondition === "heavy") {
    delayMinutes = 30;
    delayRisk = "high";
  } else if (trafficCondition === "moderate" || weatherCondition === "rain") {
    delayMinutes = 15;
    delayRisk = "medium";
  }

  // Check for better route
  const betterRouteAvailable = Math.random() < 0.2;
  const betterRouteSavingsMinutes = betterRouteAvailable ? Math.floor(Math.random() * 20) + 5 : undefined;

  return {
    loadId,
    vehicleId: vehicle.vehicleId,
    currentEta: currentEta.toISOString(),
    originalEta: originalEta.toISOString(),
    delayMinutes,
    delayRisk,
    distanceRemaining: Math.round(distanceRemaining),
    distanceUnit: "km",
    trafficCondition,
    weatherCondition,
    betterRouteAvailable,
    betterRouteSavingsMinutes,
  };
}

// Check for alerts based on telemetry
export function checkTelemetryAlerts(telemetry: LiveTelemetryData): string[] {
  const alerts: string[] = [];

  if (telemetry.engineTemp > 100) {
    alerts.push("Vehicle overheating");
  }
  if (telemetry.fuelLevel < 10) {
    alerts.push("Fuel under 10%");
  }
  if (telemetry.speed > 100) {
    alerts.push("Overspeed detected");
  }
  if (telemetry.batteryVoltage < 12) {
    alerts.push("Low battery voltage");
  }
  if (!telemetry.isIgnitionOn && telemetry.speed === 0) {
    alerts.push("Vehicle stopped unexpectedly");
  }

  return alerts;
}

// Get GPS breadcrumbs for a vehicle (last 10 minutes)
export function getGpsBreadcrumbs(vehicleId: string, minutes: number = 10): { lat: number; lng: number; timestamp: string }[] {
  const vehicle = activeVehicles.get(vehicleId);
  if (!vehicle) return [];

  const route = routes[vehicle.routeId as keyof typeof routes];
  if (!route) return [];

  // Generate simulated breadcrumbs
  const breadcrumbs: { lat: number; lng: number; timestamp: string }[] = [];
  const numPoints = Math.min(minutes * 6, 60); // One point every 10 seconds
  
  for (let i = numPoints - 1; i >= 0; i--) {
    const timeOffset = i * 10 * 1000; // 10 seconds per point
    const progressOffset = (vehicle.speed / 3600) * (i * 10 / 1000) / (route.totalDistance / route.waypoints.length);
    
    let simulatedProgress = vehicle.progress - progressOffset;
    let simulatedWaypointIndex = vehicle.currentWaypointIndex;
    
    while (simulatedProgress < 0 && simulatedWaypointIndex > 0) {
      simulatedProgress += 1;
      simulatedWaypointIndex--;
    }
    
    if (simulatedWaypointIndex >= 0 && simulatedWaypointIndex < route.waypoints.length - 1) {
      const start = route.waypoints[simulatedWaypointIndex];
      const end = route.waypoints[simulatedWaypointIndex + 1];
      const pos = interpolatePosition(start, end, Math.max(0, simulatedProgress));
      
      breadcrumbs.push({
        lat: pos.lat,
        lng: pos.lng,
        timestamp: new Date(Date.now() - timeOffset).toISOString(),
      });
    }
  }

  return breadcrumbs;
}

// Get driver behavior score
export function getDriverBehaviorScore(driverId: string): {
  overallScore: number;
  harshBrakingEvents: number;
  suddenAccelerationEvents: number;
  overspeedEvents: number;
  idleTimeMinutes: number;
} {
  // Simulate driver behavior metrics
  const harshBrakingEvents = Math.floor(Math.random() * 5);
  const suddenAccelerationEvents = Math.floor(Math.random() * 3);
  const overspeedEvents = Math.floor(Math.random() * 8);
  const idleTimeMinutes = Math.floor(Math.random() * 45);

  // Calculate overall score (100 - penalties)
  const penalty = harshBrakingEvents * 3 + suddenAccelerationEvents * 2 + overspeedEvents * 4 + idleTimeMinutes * 0.1;
  const overallScore = Math.max(0, Math.min(100, 100 - penalty));

  return {
    overallScore: Math.round(overallScore),
    harshBrakingEvents,
    suddenAccelerationEvents,
    overspeedEvents,
    idleTimeMinutes,
  };
}

// Start the simulation loop
let simulationInterval: NodeJS.Timeout | null = null;

export function startTelemetrySimulation(): void {
  if (simulationInterval) return;

  initializeDemoVehicles();

  simulationInterval = setInterval(() => {
    activeVehicles.forEach(vehicle => {
      updateVehicleState(vehicle);
    });
  }, 1000); // Update every second

  console.log("Telemetry simulation started");
}

export function stopTelemetrySimulation(): void {
  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
    console.log("Telemetry simulation stopped");
  }
}

// Get all vehicle IDs
export function getActiveVehicleIds(): string[] {
  return Array.from(activeVehicles.keys());
}
