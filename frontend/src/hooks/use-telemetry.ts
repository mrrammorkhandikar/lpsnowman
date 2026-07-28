import { useState, useEffect, useCallback, useRef } from "react";
import type { LiveTelemetryData, EtaPrediction } from "@shared/schema";

interface TelemetryState {
  vehicles: Map<string, LiveTelemetryData>;
  etaPredictions: Map<string, EtaPrediction>;
  alerts: { vehicleId: string; alerts: string[] }[];
  isConnected: boolean;
  lastUpdate: Date | null;
}

interface UseTelemetryOptions {
  subscribeAll?: boolean;
  vehicleIds?: string[];
  loadIds?: string[];
  autoReconnect?: boolean;
}

export function useTelemetry(options: UseTelemetryOptions = {}) {
  const { subscribeAll = false, vehicleIds = [], loadIds = [], autoReconnect = true } = options;
  
  const [state, setState] = useState<TelemetryState>({
    vehicles: new Map(),
    etaPredictions: new Map(),
    alerts: [],
    isConnected: false,
    lastUpdate: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    if (wsRef.current?.readyState === WebSocket.CONNECTING) return;

    const wsBaseUrl = import.meta.env.VITE_WS_BASE_URL as string | undefined;
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;

    let wsUrl: string;
    if (wsBaseUrl) {
      wsUrl = `${wsBaseUrl}/ws/telemetry`;
    } else if (apiBaseUrl) {
      const protocol = apiBaseUrl.startsWith("https") ? "wss:" : "ws:";
      const hostPart = apiBaseUrl.replace(/^https?:\/\//, "");
      wsUrl = `${protocol}//${hostPart}/ws/telemetry`;
    } else {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      wsUrl = `${protocol}//${window.location.host}/ws/telemetry`;
    }
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("Telemetry WebSocket connected");
      reconnectAttempts.current = 0;
      setState(prev => ({ ...prev, isConnected: true }));

      // Subscribe based on options
      if (subscribeAll) {
        ws.send(JSON.stringify({ type: "subscribe", all: true }));
      }
      vehicleIds.forEach(vehicleId => {
        ws.send(JSON.stringify({ type: "subscribe", vehicleId }));
      });
      loadIds.forEach(loadId => {
        ws.send(JSON.stringify({ type: "subscribe", loadId }));
      });
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleMessage(message);
      } catch (error) {
        console.error("Failed to parse telemetry message:", error);
      }
    };

    ws.onclose = () => {
      console.log("Telemetry WebSocket disconnected");
      setState(prev => ({ ...prev, isConnected: false }));
      
      if (autoReconnect && reconnectAttempts.current < 5) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttempts.current++;
          connect();
        }, delay);
      }
    };

    ws.onerror = (error) => {
      console.error("Telemetry WebSocket error:", error);
    };
  }, [subscribeAll, vehicleIds, loadIds, autoReconnect]);

  const handleMessage = useCallback((message: any) => {
    setState(prev => {
      const newState = { ...prev, lastUpdate: new Date() };

      switch (message.type) {
        case "telemetry":
          const newVehicles = new Map(prev.vehicles);
          newVehicles.set(message.data.vehicleId, message.data);
          return { ...newState, vehicles: newVehicles };

        case "telemetry_all":
          const allVehicles = new Map<string, LiveTelemetryData>();
          message.data.forEach((t: LiveTelemetryData) => {
            allVehicles.set(t.vehicleId, t);
          });
          return { ...newState, vehicles: allVehicles };

        case "eta_prediction":
          const newEtas = new Map(prev.etaPredictions);
          if (message.data) {
            newEtas.set(message.data.loadId, message.data);
          }
          return { ...newState, etaPredictions: newEtas };

        case "alerts":
          return {
            ...newState,
            alerts: [...prev.alerts.filter(a => a.vehicleId !== message.vehicleId), 
                     { vehicleId: message.vehicleId, alerts: message.data }],
          };

        case "alerts_all":
          return { ...newState, alerts: message.data };

        default:
          return newState;
      }
    });
  }, []);

  const subscribeVehicle = useCallback((vehicleId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "subscribe", vehicleId }));
    }
  }, []);

  const subscribeLoad = useCallback((loadId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "subscribe", loadId }));
    }
  }, []);

  const requestBreadcrumbs = useCallback((vehicleId: string, minutes: number = 10) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "get_breadcrumbs", vehicleId, minutes }));
    }
  }, []);

  const requestDriverBehavior = useCallback((driverId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "get_driver_behavior", driverId }));
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return {
    vehicles: Array.from(state.vehicles.values()),
    vehicleMap: state.vehicles,
    etaPredictions: state.etaPredictions,
    alerts: state.alerts,
    isConnected: state.isConnected,
    lastUpdate: state.lastUpdate,
    subscribeVehicle,
    subscribeLoad,
    requestBreadcrumbs,
    requestDriverBehavior,
    disconnect,
    reconnect: connect,
  };
}

// Simple polling hook as fallback
export function useTelemetryPolling(intervalMs: number = 5000) {
  const [vehicles, setVehicles] = useState<LiveTelemetryData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTelemetry = async () => {
      try {
        const res = await fetch("/api/telemetry/vehicles", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setVehicles(data);
          setError(null);
        } else {
          setError("Failed to fetch telemetry");
        }
      } catch (err) {
        setError("Network error");
      } finally {
        setIsLoading(false);
      }
    };

    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, intervalMs);
    return () => clearInterval(interval);
  }, [intervalMs]);

  return { vehicles, isLoading, error };
}
