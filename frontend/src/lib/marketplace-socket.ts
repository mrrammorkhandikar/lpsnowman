import { queryClient } from "./queryClient";

let socket: WebSocket | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 3000;

type MessageHandler = (data: any) => void;
const handlers: Map<string, Set<MessageHandler>> = new Map();

export function connectMarketplace(role: "carrier" | "admin" | "shipper", userId: string) {
  if (socket?.readyState === WebSocket.OPEN) {
    return;
  }
  
  // If already connecting, don't create another connection
  if (socket?.readyState === WebSocket.CONNECTING) {
    return;
  }

  // Get WebSocket URL from environment or construct from API base URL
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
  const wsBaseUrl = import.meta.env.VITE_WS_BASE_URL;
  
  let wsUrl: string;
  
  if (wsBaseUrl) {
    // Use explicit WebSocket URL if provided
    wsUrl = `${wsBaseUrl}/ws/marketplace`;
  } else if (apiBaseUrl) {
    // Convert HTTP(S) API URL to WS(S) URL
    const protocol = apiBaseUrl.startsWith('https') ? 'wss:' : 'ws:';
    const urlWithoutProtocol = apiBaseUrl.replace(/^https?:\/\//, '');
    wsUrl = `${protocol}//${urlWithoutProtocol}/ws/marketplace`;
  } else {
    // Development mode - use relative WebSocket URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    wsUrl = `${protocol}//${window.location.host}/ws/marketplace`;
  }

  socket = new WebSocket(wsUrl);

  socket.onopen = function() {
    console.log("[Marketplace] Connected to real-time updates");
    reconnectAttempts = 0;
    
    // Only send if socket is truly open
    if (this.readyState === WebSocket.OPEN) {
      this.send(JSON.stringify({
        type: "identify",
        role,
        userId,
      }));
    }
  };

  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      console.log("[Marketplace] Received:", message.type);

      if (message.type === "load_posted") {
        queryClient.invalidateQueries({ queryKey: ["/api/carrier/loads"] });
        queryClient.invalidateQueries({ queryKey: ["/api/loads"] });
        
        const loadHandlers = handlers.get("load_posted");
        loadHandlers?.forEach(handler => handler(message.load));
      }

      if (message.type === "load_updated") {
        queryClient.invalidateQueries({ queryKey: ["/api/carrier/loads"] });
        queryClient.invalidateQueries({ queryKey: ["/api/loads"] });
        queryClient.invalidateQueries({ queryKey: ["/api/loads", message.loadId] });
        
        const updateHandlers = handlers.get("load_updated");
        updateHandlers?.forEach(handler => handler(message));
      }

      if (message.type === "bid_received") {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/negotiations"] });
        queryClient.invalidateQueries({ queryKey: ["/api/bids"] });
        
        const bidHandlers = handlers.get("bid_received");
        bidHandlers?.forEach(handler => handler(message));
      }

      if (message.type === "bid_countered") {
        queryClient.invalidateQueries({ queryKey: ["/api/bids"] });
        queryClient.invalidateQueries({ queryKey: ["/api/carrier/bids"] });
        
        const counterHandlers = handlers.get("bid_countered");
        counterHandlers?.forEach(handler => handler(message));
      }

      if (message.type === "bid_accepted") {
        queryClient.invalidateQueries({ queryKey: ["/api/bids"] });
        queryClient.invalidateQueries({ queryKey: ["/api/carrier/bids"] });
        queryClient.invalidateQueries({ queryKey: ["/api/carrier/loads"] });
        queryClient.invalidateQueries({ queryKey: ["/api/shipments"] });
        queryClient.invalidateQueries({ queryKey: ["/api/carrier/dashboard/stats"] });
        queryClient.invalidateQueries({ queryKey: ["/api/settlements"] });
        queryClient.invalidateQueries({ queryKey: ["/api/settlements/carrier"] });
        queryClient.invalidateQueries({ queryKey: ["/api/carrier/performance"] });
        queryClient.invalidateQueries({ queryKey: ["/api/loads"] });
        
        const acceptHandlers = handlers.get("bid_accepted");
        acceptHandlers?.forEach(handler => handler(message));
      }

      if (message.type === "bid_rejected") {
        queryClient.invalidateQueries({ queryKey: ["/api/bids"] });
        queryClient.invalidateQueries({ queryKey: ["/api/carrier/bids"] });
        queryClient.invalidateQueries({ queryKey: ["/api/carrier/loads"] });
        
        const rejectHandlers = handlers.get("bid_rejected");
        rejectHandlers?.forEach(handler => handler(message));
      }

      if (message.type === "invoice_update") {
        queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
        queryClient.invalidateQueries({ queryKey: ["/api/invoices/shipper"] });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/invoices"] });
        queryClient.invalidateQueries({ queryKey: ["/api/settlements"] });
        queryClient.invalidateQueries({ queryKey: ["/api/settlements/carrier"] });
        queryClient.invalidateQueries({ queryKey: ["/api/carrier/dashboard/stats"] });
        
        const invoiceHandlers = handlers.get("invoice_update");
        invoiceHandlers?.forEach(handler => handler(message));
      }

      if (message.type === "negotiation_message") {
        queryClient.invalidateQueries({ queryKey: ["/api/bids/negotiations"] });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/negotiations"] });
        
        const negotiationHandlers = handlers.get("negotiation_message");
        negotiationHandlers?.forEach(handler => handler(message));
      }

      if (message.type === "verification_status_changed") {
        queryClient.invalidateQueries({ queryKey: ["/api/carrier/verification"] });
        queryClient.invalidateQueries({ queryKey: ["/api/me"] });
        
        const verificationHandlers = handlers.get("verification_status_changed");
        verificationHandlers?.forEach(handler => handler(message));
      }

      if (message.type === "otp_approved") {
        queryClient.invalidateQueries({ queryKey: ["/api/shipments"] });
        queryClient.invalidateQueries({ queryKey: ["/api/loads"] });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/otp-queue"] });
        
        const otpApprovedHandlers = handlers.get("otp_approved");
        otpApprovedHandlers?.forEach(handler => handler(message));
      }

      if (message.type === "trip_completed") {
        queryClient.invalidateQueries({ queryKey: ["/api/shipments"] });
        queryClient.invalidateQueries({ queryKey: ["/api/loads"] });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/otp-queue"] });
        queryClient.invalidateQueries({ queryKey: ["/api/carrier/dashboard/stats"] });
        queryClient.invalidateQueries({ queryKey: ["/api/carrier/performance"] });
        queryClient.invalidateQueries({ queryKey: ["/api/settlements"] });
        queryClient.invalidateQueries({ queryKey: ["/api/settlements/carrier"] });
        
        const tripCompletedHandlers = handlers.get("trip_completed");
        tripCompletedHandlers?.forEach(handler => handler(message));
      }

      if (message.type === "otp_requested") {
        queryClient.invalidateQueries({ queryKey: ["/api/shipments"] });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/otp-queue"] });
        
        const otpRequestedHandlers = handlers.get("otp_requested");
        otpRequestedHandlers?.forEach(handler => handler(message));
      }

      if (message.type === "shipment_document_uploaded") {
        // Invalidate shipper documents to refresh document categories
        queryClient.invalidateQueries({ queryKey: ["/api/shipper/documents"] });
        // Also refresh tracking page data
        queryClient.invalidateQueries({ queryKey: ["/api/shipper/tracked-shipments"] });
        queryClient.invalidateQueries({ queryKey: ["/api/shipments"] });
        
        const documentUploadedHandlers = handlers.get("shipment_document_uploaded");
        documentUploadedHandlers?.forEach(handler => handler(message));
      }

      // Handle carrier document uploads - notify admin for real-time verification
      if (message.type === "carrier_document_uploaded") {
        // Invalidate admin carrier queries to show new documents
        queryClient.invalidateQueries({ queryKey: ["/api/admin/carriers"] });
        if (message.carrierId) {
          queryClient.invalidateQueries({ queryKey: ["/api/admin/carriers", message.carrierId] });
        }
        // Also refresh verification queue
        queryClient.invalidateQueries({ queryKey: ["/api/admin/verifications"] });
        
        const carrierDocHandlers = handlers.get("carrier_document_uploaded");
        carrierDocHandlers?.forEach(handler => handler(message));
      }

      const typeHandlers = handlers.get(message.type);
      if (typeHandlers) {
        typeHandlers.forEach(handler => handler(message));
      }
    } catch (error) {
      console.error("[Marketplace] Failed to parse message:", error);
    }
  };

  socket.onclose = () => {
    console.log("[Marketplace] Disconnected");
    socket = null;

    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts++;
      console.log(`[Marketplace] Reconnecting in ${RECONNECT_DELAY}ms (attempt ${reconnectAttempts})`);
      setTimeout(() => connectMarketplace(role, userId), RECONNECT_DELAY);
    }
  };

  socket.onerror = (error) => {
    console.error("[Marketplace] WebSocket error:", error);
  };
}

export function disconnectMarketplace() {
  if (socket) {
    socket.close();
    socket = null;
  }
  reconnectAttempts = MAX_RECONNECT_ATTEMPTS;
}

export function onMarketplaceEvent(eventType: string, handler: MessageHandler): () => void {
  if (!handlers.has(eventType)) {
    handlers.set(eventType, new Set());
  }
  handlers.get(eventType)!.add(handler);

  return () => {
    handlers.get(eventType)?.delete(handler);
  };
}

export function offMarketplaceEvent(eventType: string, handler: MessageHandler): void {
  handlers.get(eventType)?.delete(handler);
}

export function isMarketplaceConnected(): boolean {
  return socket?.readyState === WebSocket.OPEN;
}
