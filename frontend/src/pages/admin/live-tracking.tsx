import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, ZoomControl } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { 
  MapPin, Truck, Package, Phone, Mail, Building2, User, 
  Navigation, Clock, RefreshCw, Loader2, Eye,
  Radio, CheckCircle, AlertCircle, ArrowRight, X, ChevronLeft, List, Calendar,
  PauseCircle, XCircle, DollarSign, FileText
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { buildFullAddress } from "@/lib/address-utils";
import { geocodeAddress } from "@/lib/intutrack-api";
import { getTriptrackRouteVisualization } from "@/lib/triptrack-route";
import { TriptrackRoutePolylineLayer, HaltFlagMarkers } from "@/components/map-trip-visual";
import { RECEIPT_CATEGORIES, getReceiptsForCategory } from "@/lib/receipt-document-types";

interface TrackedShipment {
  id: string;
  loadId: string;
  status: string;
  progress: number;
  currentStage: string;
  createdAt: string;
  startedAt: string | null;
  eta: string | null;
  currentLocation: {
    lat: number | null;
    lng: number | null;
    address: string | null;
  };
  otp: {
    startRequested: boolean;
    startVerified: boolean;
    endRequested: boolean;
    endVerified: boolean;
  };
  load: {
    id: string;
    referenceNumber: number | null;
    pickupCity: string;
    pickupAddress: string;
    pickupState: string | null;
    dropoffCity: string;
    dropoffAddress: string;
    dropoffState: string | null;
    materialType: string | null;
    weight: string;
    requiredTruckType: string | null;
    pickupDate: string | null;
    deliveryDate: string | null;
    adminFinalPrice: string | null;
    finalPrice: string | null;
    advancePaymentPercent: number | null;
    carrierAdvancePercent: number | null;
    priceBreakdown: Record<string, unknown> | null;
    triptrackLocations?: {
      lat: number;
      lng: number;
      createdAt?: string | null;
      updatedAt?: string | null;
      address?: string | null;
      city?: string | null;
      state?: string | null;
      pincode?: string | number | null;
    }[] | null;
  } | null;
  shipper: {
    id: string;
    username: string;
    companyName: string;
    contactName: string;
    phone: string | null;
    email: string | null;
    address: string | null;
  } | null;
  receiver: {
    name: string | null;
    phone: string | null;
    email: string | null;
    businessName: string | null;
    address: string | null;
    city: string | null;
  } | null;
  carrier: {
    id: string;
    username: string;
    companyName: string;
    phone: string | null;
    carrierType: string;
  } | null;
  driver: {
    name: string;
    phone: string | null;
  } | null;
  truck: {
    id: string;
    registrationNumber: string;
    truckType: string;
    capacity: number;
  } | null;
  timeline: {
    stage: string;
    completed: boolean;
    timestamp: string | null;
    location: string;
  }[];
  documents: {
    id: string;
    documentType: string;
    fileName: string;
    fileUrl: string | null;
    fileSize: number | null;
    isVerified: boolean | null;
    createdAt: string | null;
  }[];
  financeReview: {
    id: string;
    status: string;
    comment: string | null;
    paymentStatus: string;
    reviewedAt: string | null;
    reviewerName: string;
  } | null;
}

const stageLabels: Record<string, string> = {
  pickup_scheduled: "Awaiting Pickup",
  at_pickup: "At Pickup Location",
  in_transit: "In Transit",
  delivered: "Delivered",
};

const timelineStageLabels: Record<string, string> = {
  load_created: "Load Created",
  carrier_assigned: "Carrier Assigned",
  reached_pickup: "Reached Pickup",
  loaded: "Loaded",
  in_transit: "In Transit",
  arrived_at_drop: "Arrived at Drop",
  delivered: "Delivered",
};

const documentTypeLabels: Record<string, string> = {
  lr_consignment: "LR / Consignment Note",
  eway_bill: "E-way Bill",
  loading_photos: "Loading Photos",
  pod: "Proof of Delivery (POD)",
  invoice: "Invoice",
  other: "Other Document",
};

const stageBadgeColors: Record<string, string> = {
  pickup_scheduled: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  at_pickup: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  in_transit: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  delivered: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

// City coordinates for mapping
const cityCoordinates: Record<string, { lat: number; lng: number }> = {
  "Mumbai": { lat: 19.0760, lng: 72.8777 },
  "Indore": { lat: 22.7196, lng: 75.8577 },
  "Delhi": { lat: 28.6139, lng: 77.2090 },
  "Bangalore": { lat: 12.9716, lng: 77.5946 },
  "Chennai": { lat: 13.0827, lng: 80.2707 },
  "Kolkata": { lat: 22.5726, lng: 88.3639 },
  "Hyderabad": { lat: 17.3850, lng: 78.4867 },
  "Ahmedabad": { lat: 23.0225, lng: 72.5714 },
  "Pune": { lat: 18.5204, lng: 73.8567 },
  "Jaipur": { lat: 26.9124, lng: 75.7873 },
  "Lucknow": { lat: 26.8467, lng: 80.9462 },
  "Kanpur": { lat: 26.4499, lng: 80.3319 },
  "Nagpur": { lat: 21.1458, lng: 79.0882 },
  "Visakhapatnam": { lat: 17.6868, lng: 83.2185 },
  "Bhopal": { lat: 23.2599, lng: 77.4126 },
  "Patna": { lat: 25.5941, lng: 85.1376 },
  "Vadodara": { lat: 22.3072, lng: 73.1812 },
  "Ghaziabad": { lat: 28.6692, lng: 77.4538 },
  "Ludhiana": { lat: 30.9010, lng: 75.8573 },
  "Agra": { lat: 27.1767, lng: 78.0081 },
  "Nashik": { lat: 19.9975, lng: 73.7898 },
  "Faridabad": { lat: 28.4089, lng: 77.3178 },
  "Meerut": { lat: 28.9845, lng: 77.7064 },
  "Rajkot": { lat: 22.3039, lng: 70.8022 },
  "Varanasi": { lat: 25.3176, lng: 82.9739 },
  "Srinagar": { lat: 34.0837, lng: 74.7973 },
  "Aurangabad": { lat: 19.8762, lng: 75.3433 },
  "Dhanbad": { lat: 23.7957, lng: 86.4304 },
  "Amritsar": { lat: 31.6340, lng: 74.8723 },
  "Allahabad": { lat: 25.4358, lng: 81.8463 },
  "Ranchi": { lat: 23.3441, lng: 85.3096 },
  "Coimbatore": { lat: 11.0168, lng: 76.9558 },
  "Jabalpur": { lat: 23.1815, lng: 79.9864 },
  "Gwalior": { lat: 26.2183, lng: 78.1828 },
  "Vijayawada": { lat: 16.5062, lng: 80.6480 },
  "Jodhpur": { lat: 26.2389, lng: 73.0243 },
  "Madurai": { lat: 9.9252, lng: 78.1198 },
  "Raipur": { lat: 21.2514, lng: 81.6296 },
  "Kota": { lat: 25.2138, lng: 75.8648 },
  "Guwahati": { lat: 26.1445, lng: 91.7362 },
  "Chandigarh": { lat: 30.7333, lng: 76.7794 },
  "Solapur": { lat: 17.6599, lng: 75.9064 },
  "Hubli": { lat: 15.3647, lng: 75.1240 },
  "Mysore": { lat: 12.2958, lng: 76.6394 },
  "Tiruchirappalli": { lat: 10.7905, lng: 78.7047 },
  "Bareilly": { lat: 28.3670, lng: 79.4304 },
  "Aligarh": { lat: 27.8974, lng: 78.0880 },
  "Tiruppur": { lat: 11.1085, lng: 77.3411 },
  "Moradabad": { lat: 28.8386, lng: 78.7733 },
  "Jalandhar": { lat: 31.3260, lng: 75.5762 },
  "Bhubaneswar": { lat: 20.2961, lng: 85.8245 },
  "Salem": { lat: 11.6643, lng: 78.1460 },
  "Warangal": { lat: 17.9784, lng: 79.5941 },
  "Guntur": { lat: 16.3067, lng: 80.4365 },
  "Bhiwandi": { lat: 19.2967, lng: 73.0631 },
  "Saharanpur": { lat: 29.9680, lng: 77.5510 },
  "Gorakhpur": { lat: 26.7606, lng: 83.3732 },
  "Bikaner": { lat: 28.0229, lng: 73.3119 },
  "Amravati": { lat: 20.9374, lng: 77.7796 },
  "Noida": { lat: 28.5355, lng: 77.3910 },
  "Jamshedpur": { lat: 22.8046, lng: 86.2029 },
  "Bhilai": { lat: 21.2094, lng: 81.4285 },
  "Cuttack": { lat: 20.4625, lng: 85.8830 },
  "Firozabad": { lat: 27.1591, lng: 78.3957 },
  "Kochi": { lat: 9.9312, lng: 76.2673 },
  "Nellore": { lat: 14.4426, lng: 79.9865 },
  "Bhavnagar": { lat: 21.7645, lng: 72.1519 },
  "Dehradun": { lat: 30.3165, lng: 78.0322 },
  "Durgapur": { lat: 23.5204, lng: 87.3119 },
  "Asansol": { lat: 23.6739, lng: 86.9524 },
  "Rourkela": { lat: 22.2604, lng: 84.8536 },
  "Nanded": { lat: 19.1383, lng: 77.3210 },
  "Kolhapur": { lat: 16.7050, lng: 74.2433 },
  "Ajmer": { lat: 26.4499, lng: 74.6399 },
  "Akola": { lat: 20.7059, lng: 77.0203 },
  "Gulbarga": { lat: 17.3297, lng: 76.8343 },
  "Jamnagar": { lat: 22.4707, lng: 70.0577 },
  "Ujjain": { lat: 23.1765, lng: 75.7885 },
  "Loni": { lat: 28.7485, lng: 77.2917 },
  "Siliguri": { lat: 26.7271, lng: 88.3953 },
  "Jhansi": { lat: 25.4484, lng: 78.5685 },
  "Ulhasnagar": { lat: 19.2183, lng: 73.1631 },
  "Jammu": { lat: 32.7266, lng: 74.8570 },
  "Mangalore": { lat: 12.9141, lng: 74.8560 },
  "Erode": { lat: 11.3410, lng: 77.7172 },
  "Belgaum": { lat: 15.8497, lng: 74.4977 },
  "Ambattur": { lat: 13.1143, lng: 80.1548 },
  "Tirunelveli": { lat: 8.7139, lng: 77.7567 },
  "Malegaon": { lat: 20.5579, lng: 74.5089 },
  "Gaya": { lat: 24.7914, lng: 85.0002 },
  "Jalgaon": { lat: 21.0077, lng: 75.5626 },
  "Udaipur": { lat: 24.5854, lng: 73.7125 },
};

function getCityCoordinates(cityName: string): { lat: number; lng: number } | null {
  const normalizedCity = cityName.trim();
  
  if (cityCoordinates[normalizedCity]) {
    return cityCoordinates[normalizedCity];
  }
  
  const cityKey = Object.keys(cityCoordinates).find(
    key => normalizedCity.toLowerCase().includes(key.toLowerCase()) ||
           key.toLowerCase().includes(normalizedCity.toLowerCase())
  );
  
  if (cityKey) {
    return cityCoordinates[cityKey];
  }
  
  return null;
}

// Create pickup marker icon
const pickupIcon = L.divIcon({
  className: "custom-marker",
  html: `<div style="background: #22c55e; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

// Create dropoff marker icon
const dropoffIcon = L.divIcon({
  className: "custom-marker",
  html: `<div style="background: #ef4444; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

// Create custom truck icon
const createTruckIcon = (isLive: boolean, isSelected: boolean) => {
  const color = isLive ? "#22c55e" : "#6b7280";
  const size = isSelected ? 40 : 32;
  return L.divIcon({
    html: `<div style="
      background: ${color};
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      ${isSelected ? 'transform: scale(1.2);' : ''}
    ">
      <svg width="${size * 0.5}" height="${size * 0.5}" viewBox="0 0 24 24" fill="white">
        <path d="M18 18.5a1.5 1.5 0 1 1-1.5-1.5 1.5 1.5 0 0 1 1.5 1.5zm-12 0A1.5 1.5 0 1 1 4.5 17 1.5 1.5 0 0 1 6 18.5zM21 12v4a1 1 0 0 1-1 1h-1a3 3 0 0 0-6 0H9a3 3 0 0 0-6 0H2a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v4h2l3 4h2z"/>
      </svg>
    </div>`,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

// Component to fit map bounds to markers on initial load only
function FitBoundsToMarkers({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  const [hasFitBounds, setHasFitBounds] = useState(false);
  
  useEffect(() => {
    if (!hasFitBounds && positions.length > 0) {
      const bounds = L.latLngBounds(positions.map(p => L.latLng(p[0], p[1])));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
      setHasFitBounds(true);
    }
  }, [map, positions, hasFitBounds]);
  
  return null;
}

// Component to center map on selected shipment
function CenterOnShipment({ position }: { position: [number, number] | null }) {
  const map = useMap();
  
  useEffect(() => {
    if (position) {
      map.flyTo(position, 12, { duration: 0.5 });
    }
  }, [position?.[0], position?.[1]]);
  
  return null;
}

const reviewStatusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  pending: { label: "Pending Review", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400", icon: Clock },
  approved: { label: "Approved", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", icon: CheckCircle },
  on_hold: { label: "On Hold", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400", icon: PauseCircle },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", icon: XCircle },
};

const paymentStatusConfig: Record<string, { label: string; color: string }> = {
  not_released: { label: "Not Released", color: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400" },
  processing: { label: "Processing", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  released: { label: "Released", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
};

export default function AdminLiveTrackingPage() {
  const { toast } = useToast();
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [telemetryData, setTelemetryData] = useState<Record<string, { lat: number; lng: number; speed?: number }>>({});
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [reviewComment, setReviewComment] = useState("");
  // Mobile bottom sheet height (as vh percentage)
  const [sheetHeight, setSheetHeight] = useState(55);
  const dragStartY = useRef<number | null>(null);
  const dragStartHeight = useRef<number>(55);

  const handleDragStart = (e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
    dragStartHeight.current = sheetHeight;
  };

  const handleDragMove = (e: React.TouchEvent) => {
    if (dragStartY.current === null) return;
    const deltaY = dragStartY.current - e.touches[0].clientY;
    const deltaVh = (deltaY / window.innerHeight) * 100;
    const newHeight = Math.min(92, Math.max(25, dragStartHeight.current + deltaVh));
    setSheetHeight(newHeight);
  };

  const handleDragEnd = () => {
    // Snap to nearest position: 25vh, 55vh, 92vh
    const snaps = [25, 55, 92];
    const nearest = snaps.reduce((prev, curr) =>
      Math.abs(curr - sheetHeight) < Math.abs(prev - sheetHeight) ? curr : prev
    );
    setSheetHeight(nearest);
    dragStartY.current = null;
  };
  const [geocodedSelectedPickup, setGeocodedSelectedPickup] = useState<{ lat: number; lng: number } | null>(null);
  const [geocodedSelectedDropoff, setGeocodedSelectedDropoff] = useState<{ lat: number; lng: number } | null>(null);

  const { data: shipments = [], isLoading, refetch, isRefetching } = useQuery<TrackedShipment[]>({
    queryKey: ["/api/admin/live-tracking"],
    refetchInterval: 30000,
  });

  // Derive selectedShipment from live shipments data — auto-updates when query refetches
  const selectedShipment = selectedShipmentId ? (shipments.find(s => s.id === selectedShipmentId) ?? null) : null;

  const handleLiveTrackingRefresh = async () => {
    try {
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/live-tracking"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/shipments"] });
      const r = await refetch();
      if (r.error) {
        throw r.error instanceof Error ? r.error : new Error(String(r.error));
      }
      toast({
        title: "Tracking updated",
        description: `${r.data?.length ?? 0} shipment(s) loaded.`,
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Could not refresh tracking.";
      toast({
        title: "Refresh failed",
        description: message,
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    const load = selectedShipment?.load;
    if (!load) {
      setGeocodedSelectedPickup(null);
      setGeocodedSelectedDropoff(null);
      return;
    }
    const pickupFull = buildFullAddress(load as any, "pickup");
    const dropoffFull = buildFullAddress(load as any, "dropoff");
    let cancelled = false;
    if (pickupFull) {
      geocodeAddress(pickupFull).then((coords) => {
        if (!cancelled && coords) setGeocodedSelectedPickup(coords);
        else if (!cancelled) setGeocodedSelectedPickup(null);
      });
    } else setGeocodedSelectedPickup(null);
    if (dropoffFull) {
      geocodeAddress(dropoffFull).then((coords) => {
        if (!cancelled && coords) setGeocodedSelectedDropoff(coords);
        else if (!cancelled) setGeocodedSelectedDropoff(null);
      });
    } else setGeocodedSelectedDropoff(null);
    return () => { cancelled = true; };
  }, [selectedShipment?.id, selectedShipment?.load?.pickupAddress, selectedShipment?.load?.dropoffAddress, selectedShipment?.load?.pickupCity, selectedShipment?.load?.dropoffCity]);

  const reviewMutation = useMutation({
    mutationFn: async (data: { shipmentId: string; loadId: string; status: string; comment: string }) => {
      const res = await apiRequest("POST", "/api/finance/reviews", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/live-tracking"] });
      queryClient.invalidateQueries({ queryKey: ["/api/finance/shipments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/finance/reviews/all"] });
      toast({ title: "Review Submitted", description: "Document review has been recorded." });
      setReviewComment("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to submit review.", variant: "destructive" });
    },
  });

  const paymentMutation = useMutation({
    mutationFn: async (data: { reviewId: string; paymentStatus: string }) => {
      const res = await apiRequest("PATCH", `/api/finance/reviews/${data.reviewId}/payment`, { paymentStatus: data.paymentStatus });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/live-tracking"] });
      queryClient.invalidateQueries({ queryKey: ["/api/finance/shipments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/finance/reviews/all"] });
      toast({ title: "Payment Updated", description: "Payment status has been updated." });
    },
  });

  const verifyDocumentMutation = useMutation({
    mutationFn: async (data: { documentId: string; isVerified: boolean }) => {
      const res = await apiRequest("PATCH", `/api/admin/documents/${data.documentId}/verify`, { isVerified: data.isVerified });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/live-tracking"] });
      queryClient.invalidateQueries({ queryKey: ["/api/finance/shipments"] });
      toast({ title: "Document Approved", description: "Document has been verified and is now visible for review." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to verify document.", variant: "destructive" });
    },
  });

  const handleReview = (status: string) => {
    if (!selectedShipment?.loadId) {
      toast({
        title: "Cannot submit review",
        description: "This shipment has no load reference.",
        variant: "destructive",
      });
      return;
    }
    reviewMutation.mutate({
      shipmentId: selectedShipment.id,
      loadId: selectedShipment.loadId,
      status,
      comment: reviewComment,
    });
  };

  // Connect to telemetry WebSocket for real-time updates
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout>;

    const connect = () => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      ws = new WebSocket(`${protocol}//${window.location.host}/ws/telemetry`);

      ws.onopen = () => {
        ws?.send(JSON.stringify({ type: "subscribe", all: true }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "position_update" && data.vehicleId) {
            setTelemetryData(prev => ({
              ...prev,
              [data.vehicleId]: {
                lat: data.lat,
                lng: data.lng,
                speed: data.speed,
              }
            }));
          }
        } catch (e) {
          console.error("Failed to parse telemetry message:", e);
        }
      };

      ws.onclose = () => {
        reconnectTimeout = setTimeout(connect, 5000);
      };
    };

    connect();

    return () => {
      ws?.close();
      clearTimeout(reconnectTimeout);
    };
  }, []);

  // Apply filters
  const filteredShipments = shipments.filter(shipment => {
    const matchesSearch = searchQuery === "" || 
      shipment.load?.referenceNumber?.toString().includes(searchQuery) ||
      shipment.load?.pickupCity?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shipment.load?.dropoffCity?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shipment.shipper?.companyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shipment.carrier?.companyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shipment.truck?.registrationNumber?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStage = stageFilter === "all" || shipment.currentStage === stageFilter;
    
    return matchesSearch && matchesStage;
  });

  // Stats
  const stats = {
    total: shipments.length,
    inTransit: shipments.filter(s => s.currentStage === "in_transit").length,
    atPickup: shipments.filter(s => s.currentStage === "at_pickup").length,
    awaiting: shipments.filter(s => s.currentStage === "pickup_scheduled").length,
    delivered: shipments.filter(s => s.currentStage === "delivered").length,
  };

  const handleSelectShipment = useCallback((shipment: TrackedShipment) => {
    setSelectedShipmentId(shipment.id);
    setReviewComment(shipment.financeReview?.comment || "");
  }, []);

  // Get position for a shipment (from telemetry or fallback)
  const getShipmentPosition = useCallback((shipment: TrackedShipment): [number, number] | null => {
    if (shipment.currentStage === "delivered" && shipment.load?.dropoffCity) {
      const c = getCityCoordinates(shipment.load.dropoffCity);
      if (c) return [c.lat, c.lng];
    }
    const telemetry = telemetryData[shipment.truck?.registrationNumber || ""];
    if (telemetry) {
      return [telemetry.lat, telemetry.lng];
    }
    // Fallback to last IntuTrack triptrack location from load, if available
    const tripPoints =
      (shipment.load?.triptrackLocations as { lat: number; lng: number }[] | null | undefined) || null;
    if (tripPoints && Array.isArray(tripPoints) && tripPoints.length > 0) {
      const lastPoint = tripPoints[tripPoints.length - 1];
      if (typeof lastPoint.lat === "number" && typeof lastPoint.lng === "number") {
        return [lastPoint.lat, lastPoint.lng];
      }
    }
    // Legacy fallback to shipment.currentLocation
    if (shipment.currentLocation?.lat && shipment.currentLocation?.lng) {
      return [shipment.currentLocation.lat, shipment.currentLocation.lng];
    }
    return null;
  }, [telemetryData]);

  // Get all marker positions for bounds fitting
  const markerPositions = useMemo(() => {
    return filteredShipments
      .map(s => getShipmentPosition(s))
      .filter((p): p is [number, number] => p !== null);
  }, [filteredShipments, getShipmentPosition]);

  // Selected shipment position for centering
  const selectedPosition = selectedShipment ? getShipmentPosition(selectedShipment) : null;

  const getLocationDisplay = (shipment: TrackedShipment) => {
    // Once delivered, always display the final dropoff point (even if telemetry still streams).
    if (shipment.currentStage === "delivered") {
      const dropoffParts = [
        shipment.load?.dropoffAddress,
        shipment.load?.dropoffCity,
        shipment.load?.dropoffState,
      ].filter(Boolean);
      if (dropoffParts.length > 0) return dropoffParts.join(", ");
      // Fallback to receiver address if load is missing (should be rare).
      const receiverParts = [shipment.receiver?.address, shipment.receiver?.city].filter(Boolean);
      if (receiverParts.length > 0) return receiverParts.join(", ");
    }

    const telemetry = telemetryData[shipment.truck?.registrationNumber || ""];
    if (telemetry) {
      return `${telemetry.lat.toFixed(4)}, ${telemetry.lng.toFixed(4)}${telemetry.speed ? ` @ ${telemetry.speed.toFixed(0)} km/h` : ""}`;
    }

    // Prefer the last TripTrack location if available (it is the closest to "latest location" from JSON).
    const tripPoints =
      (shipment.load?.triptrackLocations as
        | {
            lat: number;
            lng: number;
            createdAt?: string | null;
            updatedAt?: string | null;
            address?: string | null;
            city?: string | null;
            state?: string | null;
            pincode?: string | number | null;
          }[]
        | null
        | undefined) || null;
    if (tripPoints && Array.isArray(tripPoints) && tripPoints.length > 0) {
      const lastPoint = tripPoints[tripPoints.length - 1];
      const addressParts = [
        lastPoint.address,
        lastPoint.city,
        lastPoint.state,
        lastPoint.pincode != null && String(lastPoint.pincode).trim() !== "" ? String(lastPoint.pincode) : null,
      ].filter(Boolean);
      if (addressParts.length > 0) return addressParts.join(", ");
      if (typeof lastPoint.lat === "number" && typeof lastPoint.lng === "number") {
        return `${lastPoint.lat.toFixed(4)}, ${lastPoint.lng.toFixed(4)}`;
      }
    }

    if (shipment.currentLocation?.address) {
      return shipment.currentLocation.address;
    }
    if (shipment.currentLocation?.lat && shipment.currentLocation?.lng) {
      return `${shipment.currentLocation.lat.toFixed(4)}, ${shipment.currentLocation.lng.toFixed(4)}`;
    }
    return "Location updating...";
  };

  // India center for default view
  const defaultCenter: [number, number] = [20.5937, 78.9629];

  return (
    <div className="flex flex-col h-full w-full relative" data-testid="page-admin-live-tracking">
      {/* Map Container - Full Screen (behind everything) */}
      <div className="absolute inset-0 w-full h-full z-0 relative">
        <MapContainer
          center={defaultCenter}
          zoom={5}
          zoomControl={true}
          className="h-full w-full"
          style={{ zIndex: 0 }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {/* Fit bounds on initial load */}
          {markerPositions.length > 0 && (
            <FitBoundsToMarkers positions={markerPositions} />
          )}
          
          {/* Center on selected shipment */}
          {selectedPosition && (
            <CenterOnShipment position={selectedPosition} />
          )}
          
          {/* Pickup & Dropoff Markers + Route Polyline for Selected Shipment */}
          {selectedShipment?.load && (() => {
            const pickupCoords = geocodedSelectedPickup ?? getCityCoordinates(selectedShipment.load.pickupCity);
            const dropoffCoords = geocodedSelectedDropoff ?? getCityCoordinates(selectedShipment.load.dropoffCity);

            // Build route positions using IntuTrack triptrackLocations
            const tripPoints =
              (selectedShipment.load.triptrackLocations as { lat: number; lng: number }[] | null | undefined) ||
              null;
            const validTripPoints =
              tripPoints?.filter(
                (p) => typeof p.lat === "number" && typeof p.lng === "number",
              ) || [];
            const triptrackViz = getTriptrackRouteVisualization(validTripPoints);

            const isInTransit = selectedShipment.currentStage === "in_transit";
            const isCompleted = selectedShipment.currentStage === "delivered";

            const routePositions: [number, number][] = [];

            // Always start from pickup point if available
            if (pickupCoords) {
              routePositions.push([pickupCoords.lat, pickupCoords.lng]);
            }

            for (const p of triptrackViz.triptrackPolyline) {
              routePositions.push(p);
            }

            // If trip is ended, extend route from last truck point to drop point
            if (isCompleted && dropoffCoords) {
              routePositions.push([dropoffCoords.lat, dropoffCoords.lng]);
            }
            
            return (
              <>
                {/* Pickup Marker */}
                {pickupCoords && (
                  <Marker position={[pickupCoords.lat, pickupCoords.lng]} icon={pickupIcon}>
                    <Popup>
                      <div className="text-center">
                        <p className="font-medium text-green-600">Pickup Location</p>
                        <p className="text-sm">{selectedShipment.load.pickupCity}</p>
                        {selectedShipment.load.pickupAddress && (
                          <p className="text-xs text-gray-600 mt-1">
                            {selectedShipment.load.pickupAddress}
                          </p>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                )}
                
                {/* Dropoff Marker */}
                {dropoffCoords && (
                  <Marker position={[dropoffCoords.lat, dropoffCoords.lng]} icon={dropoffIcon}>
                    <Popup>
                      <div className="text-center">
                        <p className="font-medium text-red-600">Dropoff Location</p>
                        <p className="text-sm">{selectedShipment.load.dropoffCity}</p>
                        {selectedShipment.load.dropoffAddress && (
                          <p className="text-xs text-gray-600 mt-1">
                            {selectedShipment.load.dropoffAddress}
                          </p>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                )}
                
                {routePositions.length > 1 && (isInTransit || isCompleted) && (
                  <TriptrackRoutePolylineLayer positions={routePositions} color="#22c55e" weight={4} opacity={0.9} />
                )}
                {(isInTransit || isCompleted) && <HaltFlagMarkers halts={triptrackViz.halts} darkPopup />}
              </>
            );
          })()}
          
          {/* Truck Markers */}
          {filteredShipments.map((shipment) => {
            const position = getShipmentPosition(shipment);
            if (!position) return null;
            
            const isLive = !!telemetryData[shipment.truck?.registrationNumber || ""];
            const isSelected = selectedShipment?.id === shipment.id;
            
            return (
              <Marker
                key={shipment.id}
                position={position}
                icon={createTruckIcon(isLive, isSelected)}
                eventHandlers={{
                  click: () => handleSelectShipment(shipment),
                }}
              >
                <Popup>
                  <div className="min-w-[200px]">
                    <div className="font-bold mb-1">
                      LD-{shipment.load?.referenceNumber?.toString().padStart(3, "0") || "???"}
                    </div>
                    <div className="text-sm text-gray-600 mb-2">
                      {shipment.load?.pickupCity} → {shipment.load?.dropoffCity}
                    </div>
                    <div className="text-xs space-y-1">
                      <p><strong>Truck:</strong> {shipment.truck?.registrationNumber}</p>
                      <p><strong>Carrier:</strong> {shipment.carrier?.companyName}</p>
                      <p><strong>Status:</strong> {stageLabels[shipment.currentStage]}</p>
                      {isLive && telemetryData[shipment.truck?.registrationNumber || ""]?.speed && (
                        <p><strong>Speed:</strong> {telemetryData[shipment.truck?.registrationNumber || ""]?.speed?.toFixed(0)} km/h</p>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        {/* Toggle Panel Button - inside map, centered at top */}
        <div className="absolute top-4 left-0 right-0 z-[1003] flex justify-center pointer-events-none">
          <Button
            variant="secondary"
            size="sm"
            className="pointer-events-auto shadow-lg bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 inline-flex items-center gap-2 px-4"
            onClick={() => setIsPanelOpen(!isPanelOpen)}
            data-testid="button-toggle-panel"
          >
            <List className="h-4 w-4 flex-shrink-0" />
            <span className="whitespace-nowrap">Shipments ({stats.total})</span>
          </Button>
        </div>
      </div>

      {/* Collapsible Side Panel */}
      <div 
        className={`
          absolute top-0 left-0 h-full z-[1001] bg-background border-r shadow-lg
          transition-transform duration-300 ease-in-out
          ${isPanelOpen ? 'translate-x-0' : '-translate-x-full'}
          w-full sm:w-[380px] md:w-[400px] lg:w-[420px]
        `}
      >
        <div className="flex flex-col h-full">
          {/* Panel Header */}
          <div className="flex items-center justify-between p-3 sm:p-4 border-b">
            <div>
              <h1 className="text-base sm:text-lg font-bold">Live Tracking</h1>
              <p className="text-xs text-muted-foreground">{stats.total} shipments</p>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => void handleLiveTrackingRefresh()}
                disabled={isRefetching}
                data-testid="button-refresh"
                className="h-8 w-8 sm:h-10 sm:w-10"
              >
                {isRefetching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsPanelOpen(false)}
                data-testid="button-close-panel"
                className="h-8 w-8 sm:h-10 sm:w-10"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-5 gap-1 p-2 sm:p-3 border-b bg-muted/30">
            <div className="text-center">
              <p className="text-base sm:text-lg font-bold">{stats.total}</p>
              <p className="text-[9px] sm:text-[10px] text-muted-foreground">Total</p>
            </div>
            <div className="text-center">
              <p className="text-base sm:text-lg font-bold text-yellow-600">{stats.awaiting}</p>
              <p className="text-[9px] sm:text-[10px] text-muted-foreground">Awaiting</p>
            </div>
            <div className="text-center">
              <p className="text-base sm:text-lg font-bold text-blue-600">{stats.atPickup}</p>
              <p className="text-[9px] sm:text-[10px] text-muted-foreground">At Pickup</p>
            </div>
            <div className="text-center">
              <p className="text-base sm:text-lg font-bold text-green-600">{stats.inTransit}</p>
              <p className="text-[9px] sm:text-[10px] text-muted-foreground">In Transit</p>
            </div>
            <div className="text-center">
              <p className="text-base sm:text-lg font-bold text-gray-600">{stats.delivered}</p>
              <p className="text-[9px] sm:text-[10px] text-muted-foreground">Delivered</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center flex-wrap gap-2 p-2 sm:p-3 border-b">
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 sm:h-9 text-xs sm:text-sm flex-1 min-w-[100px]"
              data-testid="input-search"
            />
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="w-[110px] sm:w-[130px] h-8 sm:h-9 text-xs sm:text-sm" data-testid="select-stage-filter">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pickup_scheduled">Awaiting</SelectItem>
                <SelectItem value="at_pickup">At Pickup</SelectItem>
                <SelectItem value="in_transit">In Transit</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Shipment List */}
          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredShipments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Truck className="h-12 w-12 mb-4 opacity-50" />
                <p>No shipments found</p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredShipments.map((shipment) => {
                  const isSelected = selectedShipment?.id === shipment.id;
                  const hasLive = !!telemetryData[shipment.truck?.registrationNumber || ""];
                  
                  return (
                    <div
                      key={shipment.id}
                      className={`p-2 sm:p-3 cursor-pointer transition-colors ${
                        isSelected ? 'bg-primary/10 border-l-4 border-l-primary' : 'hover:bg-muted/50'
                      }`}
                      onClick={() => handleSelectShipment(shipment)}
                      data-testid={`shipment-row-${shipment.id}`}
                    >
                      <div className="flex items-start gap-2 sm:gap-3">
                        <div className={`
                          w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center flex-shrink-0
                          ${hasLive ? 'bg-green-100 dark:bg-green-900/30' : 'bg-muted'}
                        `}>
                          <Truck className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${hasLive ? 'text-green-600' : 'text-muted-foreground'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 sm:gap-2 mb-1 flex-wrap">
                            <span className="font-semibold text-xs sm:text-sm">
                              LD-{shipment.load?.referenceNumber ? String(shipment.load.referenceNumber).padStart(3, "0") : "???"}
                            </span>
                            <Badge className={`text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0 ${stageBadgeColors[shipment.currentStage] || ""}`}>
                              {stageLabels[shipment.currentStage]?.split(" ")[0] || shipment.currentStage}
                            </Badge>
                            {hasLive && (
                              <Radio className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-green-500 animate-pulse" />
                            )}
                          </div>
                          
                          <div className="flex items-center gap-1 text-[11px] sm:text-xs text-muted-foreground mb-1">
                            <span className="truncate">{shipment.load?.pickupCity}</span>
                            <ArrowRight className="h-2.5 w-2.5 sm:h-3 sm:w-3 flex-shrink-0" />
                            <span className="truncate">{shipment.load?.dropoffCity}</span>
                          </div>

                          <div className="text-[10px] sm:text-[11px] text-muted-foreground truncate">
                            {shipment.truck?.registrationNumber || "No truck"} • {shipment.carrier?.companyName?.substring(0, 20) || "N/A"}
                          </div>
                          {shipment.load?.pickupDate && (
                            <div className="flex items-center gap-1 text-[10px] sm:text-[11px] text-muted-foreground mt-0.5">
                              <Calendar className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                              <span>Pickup: {format(new Date(shipment.load.pickupDate), "dd MMM yyyy")}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>

      {/* Selected Shipment Detail Panel */}
      {selectedShipment && (
        <div
          className="fixed bottom-0 left-0 right-0 z-[1001] sm:absolute sm:top-0 sm:right-0 sm:bottom-auto sm:h-full sm:w-[380px] md:w-[400px] lg:w-[420px] bg-background border-t sm:border-t-0 sm:border-l shadow-lg flex flex-col rounded-t-2xl sm:rounded-none transition-[height] duration-150"
          style={{ height: window.innerWidth < 640 ? `${sheetHeight}vh` : undefined }}
        >
          {/* Mobile drag handle - touch to resize */}
          <div
            className="sm:hidden flex justify-center pt-2 pb-1 flex-shrink-0 cursor-grab active:cursor-grabbing touch-none"
            onTouchStart={handleDragStart}
            onTouchMove={handleDragMove}
            onTouchEnd={handleDragEnd}
          >
            <div className="w-10 h-1.5 rounded-full bg-muted-foreground/40" />
          </div>

          {/* Header - always fixed at top */}
          <div className="flex items-center justify-between p-3 sm:p-4 border-b flex-shrink-0">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <Package className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
              <div className="min-w-0">
                <h2 className="font-bold text-sm sm:text-base truncate">
                  LD-{selectedShipment.load?.referenceNumber?.toString().padStart(3, "0") || "??"}
                </h2>
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                  {selectedShipment.load?.pickupCity} → {selectedShipment.load?.dropoffCity}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedShipmentId(null)}
              data-testid="button-close-detail"
              className="h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Mobile: everything scrollable. Desktop: fixed layout with internal scroll */}
          <div className="flex-1 overflow-y-auto sm:overflow-hidden sm:flex sm:flex-col scrollbar-hide">

          {/* Status Bar */}
          <div className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 border-b bg-muted/30 sm:flex-shrink-0">
            <Badge className={`text-[10px] sm:text-xs ${stageBadgeColors[selectedShipment.currentStage] || ""}`}>
              {stageLabels[selectedShipment.currentStage] || selectedShipment.currentStage}
            </Badge>
            <Progress value={selectedShipment.progress} className="flex-1 h-1.5 sm:h-2" />
            <span className="text-xs sm:text-sm font-medium">{selectedShipment.progress}%</span>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="timeline" className="sm:flex-1 sm:flex sm:flex-col sm:overflow-hidden">
            <div className="overflow-x-auto scrollbar-hide m-2 mx-3 sm:mx-4 sm:flex-shrink-0">
              <TabsList className="inline-flex w-auto min-w-full h-8 sm:h-10">
                <TabsTrigger value="timeline" className="text-[10px] sm:text-xs px-2 sm:px-3 whitespace-nowrap">Timeline</TabsTrigger>
                <TabsTrigger value="route" className="text-[10px] sm:text-xs px-2 sm:px-3 whitespace-nowrap">Route</TabsTrigger>
                <TabsTrigger value="shipper" className="text-[10px] sm:text-xs px-2 sm:px-3 whitespace-nowrap">Shipper</TabsTrigger>
                <TabsTrigger value="receiver" className="text-[10px] sm:text-xs px-2 sm:px-3 whitespace-nowrap">Receiver</TabsTrigger>
                <TabsTrigger value="carrier" className="text-[10px] sm:text-xs px-2 sm:px-3 whitespace-nowrap">Carrier</TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="sm:flex-1">
              <TabsContent value="route" className="p-3 sm:p-4 space-y-3 sm:space-y-4 mt-0">
                <Card>
                  <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                    <CardTitle className="text-xs sm:text-sm flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600" />
                      Pickup Location
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 sm:px-6">
                    <p className="font-medium text-sm sm:text-base">{selectedShipment.load?.pickupCity}, {selectedShipment.load?.pickupState}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">{selectedShipment.load?.pickupAddress}</p>
                    {selectedShipment.load?.pickupDate && (
                      <p className="text-xs sm:text-sm mt-1">
                        <Clock className="h-3 w-3 inline mr-1" />
                        {format(new Date(selectedShipment.load.pickupDate), "PPp")}
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                    <CardTitle className="text-xs sm:text-sm flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-600" />
                      Delivery Location
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 sm:px-6">
                    <p className="font-medium text-sm sm:text-base">{selectedShipment.load?.dropoffCity}, {selectedShipment.load?.dropoffState}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">{selectedShipment.load?.dropoffAddress}</p>
                    {selectedShipment.eta && (
                      <p className="text-xs sm:text-sm mt-1">
                        <Clock className="h-3 w-3 inline mr-1" />
                        ETA: {format(new Date(selectedShipment.eta), "PPp")}
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                    <CardTitle className="text-xs sm:text-sm">Current Location</CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 sm:px-6">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Navigation className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary flex-shrink-0" />
                      <span className="text-xs sm:text-sm break-all">{getLocationDisplay(selectedShipment)}</span>
                      {telemetryData[selectedShipment.truck?.registrationNumber || ""] && (
                        <Badge variant="outline" className="gap-1 ml-auto text-[10px] sm:text-xs">
                          <Radio className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-green-500 animate-pulse" />
                          Live
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                    <CardTitle className="text-xs sm:text-sm">Cargo Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-xs sm:text-sm px-3 sm:px-6">
                    <p><span className="text-muted-foreground">Material:</span> {selectedShipment.load?.materialType || "Not specified"}</p>
                    <p><span className="text-muted-foreground">Weight:</span> {selectedShipment.load?.weight ? `${selectedShipment.load.weight} MT` : "Not specified"}</p>
                    <p><span className="text-muted-foreground">Truck Type:</span> {selectedShipment.load?.requiredTruckType?.replace(/_/g, " ") || "Not specified"}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                    <CardTitle className="text-xs sm:text-sm">OTP Verification Status</CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 sm:px-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm">
                      <div className="flex items-center gap-2">
                        {selectedShipment.otp.startVerified ? (
                          <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600" />
                        ) : selectedShipment.otp.startRequested ? (
                          <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-yellow-600" />
                        ) : (
                          <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                        )}
                        <span>Pickup OTP</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedShipment.otp.endVerified ? (
                          <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600" />
                        ) : selectedShipment.otp.endRequested ? (
                          <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-yellow-600" />
                        ) : (
                          <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                        )}
                        <span>Delivery OTP</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Payment Details */}
                {selectedShipment.load && (() => {
                  const totalAmount = parseFloat(selectedShipment.load.adminFinalPrice || "0");
                  const carrierPayout = parseFloat(selectedShipment.load.finalPrice || "0");
                  const bd = selectedShipment.load.priceBreakdown as {
                    platformMargin?: number;
                    platformMarginPercent?: number;
                    advanceAmount?: number;
                  } | null;
                  const platformMargin = bd?.platformMargin
                    ? bd.platformMargin
                    : totalAmount > 0 && carrierPayout > 0 && totalAmount > carrierPayout
                    ? totalAmount - carrierPayout
                    : bd?.platformMarginPercent
                    ? totalAmount * (bd.platformMarginPercent / 100)
                    : 0;
                  const platformMarginPct = totalAmount > 0 ? ((platformMargin / totalAmount) * 100).toFixed(1) : "0";
                  const advancePct = selectedShipment.load.carrierAdvancePercent ?? selectedShipment.load.advancePaymentPercent ?? 0;
                  const advanceAmount = bd?.advanceAmount
                    ? bd.advanceAmount
                    : advancePct > 0
                    ? carrierPayout * (advancePct / 100)
                    : 0;
                  const fmt = (n: number) =>
                    n > 0 ? `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : "—";
                  return (
                    <Card>
                      <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                        <CardTitle className="text-xs sm:text-sm flex items-center gap-2">
                          <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600" />
                          Payment Details
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-3 sm:px-6 space-y-2 text-xs sm:text-sm">
                        <div className="flex justify-between items-center py-1 border-b">
                          <span className="text-muted-foreground">Total Amount (Shipper)</span>
                          <span className="font-semibold">{fmt(totalAmount)}</span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b">
                          <span className="text-muted-foreground">Carrier Payout</span>
                          <span className="font-semibold text-green-600">{fmt(carrierPayout)}</span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b">
                          <span className="text-muted-foreground">Platform Margin</span>
                          <span className="font-semibold text-blue-600">
                            {fmt(platformMargin)}{platformMargin > 0 ? ` (${platformMarginPct}%)` : ""}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-1">
                          <span className="text-muted-foreground">Advance</span>
                          <span className="font-semibold text-orange-600">
                            {advanceAmount > 0 ? `${fmt(advanceAmount)} (${advancePct}%)` : advancePct > 0 ? `${advancePct}%` : "—"}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}
              </TabsContent>

              <TabsContent value="timeline" className="p-3 sm:p-4 space-y-3 sm:space-y-4 mt-0">
                <Card>
                  <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                    <CardTitle className="text-xs sm:text-sm">Driver Activity Timeline</CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 sm:px-6">
                    <div className="relative">
                      {(selectedShipment.timeline || []).map((event, index) => {
                        const isLast = index === (selectedShipment.timeline?.length || 0) - 1;
                        return (
                          <div key={event.stage} className="flex gap-3 sm:gap-4 pb-3 sm:pb-4 last:pb-0">
                            <div className="relative flex flex-col items-center">
                              <div className={`flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full ${
                                event.completed 
                                  ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" 
                                  : "bg-muted text-muted-foreground"
                              }`}>
                                {event.stage === "load_created" && <Package className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                                {event.stage === "carrier_assigned" && <Truck className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                                {event.stage === "reached_pickup" && <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                                {event.stage === "loaded" && <Package className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                                {event.stage === "in_transit" && <Navigation className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                                {event.stage === "arrived_at_drop" && <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                                {event.stage === "delivered" && <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                              </div>
                              {!isLast && (
                                <div className={`w-0.5 flex-1 mt-2 ${
                                  event.completed ? "bg-green-200 dark:bg-green-800" : "bg-border"
                                }`} />
                              )}
                            </div>
                            <div className="flex-1 pt-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <p className={`font-medium text-xs sm:text-sm ${!event.completed && "text-muted-foreground"}`}>
                                  {timelineStageLabels[event.stage] || event.stage}
                                </p>
                                {event.completed && (
                                  <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-500 flex-shrink-0" />
                                )}
                              </div>
                              <p className="text-[10px] sm:text-xs text-muted-foreground break-words">{event.location}</p>
                              {event.timestamp && (
                                <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                                  {format(new Date(event.timestamp), "MMM d 'at' h:mm a")}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                    <CardTitle className="text-xs sm:text-sm">Documents</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 px-3 sm:px-6">
                    {[
                      { key: "lr_consignment", label: "LR / Consignment Note" },
                      { key: "eway_bill", label: "E-way Bill" },
                      { key: "loading_photos", label: "Loading Photos" },
                      { key: "pod", label: "Proof of Delivery (POD)" },
                      { key: "invoice", label: "Invoice" },
                      { key: "other", label: "Other Document" },
                    ].map((docItem) => {
                      const doc = (selectedShipment.documents || []).find(d => 
                        d.documentType === docItem.key
                      );
                      const hasDocument = doc?.fileUrl;
                      return (
                        <div 
                          key={docItem.key} 
                          className="p-2 bg-muted/50 rounded-lg space-y-1.5"
                          data-testid={`admin-document-${docItem.key}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <Package className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                              <span className="text-xs sm:text-sm truncate">{docItem.label}</span>
                            </div>
                            {doc?.isVerified ? (
                              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 shrink-0 text-[10px] sm:text-xs">
                                <CheckCircle className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
                                Approved
                              </Badge>
                            ) : hasDocument ? (
                              <Badge variant="outline" className="text-yellow-600 dark:text-yellow-400 border-yellow-300 dark:border-yellow-700 shrink-0 text-[10px] sm:text-xs">
                                <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
                                Pending
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground shrink-0 text-[10px] sm:text-xs">
                                Not Uploaded
                              </Badge>
                            )}
                          </div>
                          {hasDocument && !doc?.isVerified && (
                            <div className="flex items-center gap-2 pl-0 sm:pl-6 flex-wrap">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 sm:h-8 text-[10px] sm:text-xs px-2 sm:px-3"
                                onClick={async () => {
                                  if (doc.fileUrl) {
                                    try {
                                      // Get presigned URL from backend for S3 documents
                                      const response = await fetch(`/api/documents/presigned-url?path=${encodeURIComponent(doc.fileUrl)}`, {
                                        credentials: 'include',
                                      });
                                      
                                      if (!response.ok) {
                                        throw new Error(`Failed to get document URL: ${response.statusText}`);
                                      }
                                      
                                      const data = await response.json();
                                      
                                      // Open the presigned URL in new tab
                                      window.open(data.url, '_blank', 'noopener,noreferrer');
                                    } catch (error) {
                                      console.error('Error opening document:', error);
                                      toast({
                                        title: "Error",
                                        description: "Failed to open document. Please try again.",
                                        variant: "destructive",
                                      });
                                    }
                                  }
                                }}
                                data-testid={`button-view-doc-${docItem.key}`}
                              >
                                <Eye className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
                                View
                              </Button>
                              <Button
                                size="sm"
                                className="h-7 sm:h-8 text-[10px] sm:text-xs bg-green-600 text-white px-2 sm:px-3"
                                onClick={() => {
                                  verifyDocumentMutation.mutate({ documentId: doc.id, isVerified: true });
                                }}
                                disabled={verifyDocumentMutation.isPending}
                                data-testid={`button-approve-doc-${docItem.key}`}
                              >
                                <CheckCircle className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
                                Approve
                              </Button>
                            </div>
                          )}
                          {doc?.isVerified && (
                            <div className="pl-0 sm:pl-6">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 sm:h-8 text-[10px] sm:text-xs px-2 sm:px-3"
                                onClick={async () => {
                                  if (doc.fileUrl) {
                                    try {
                                      // Get presigned URL from backend for S3 documents
                                      const response = await fetch(`/api/documents/presigned-url?path=${encodeURIComponent(doc.fileUrl)}`, {
                                        credentials: 'include',
                                      });
                                      
                                      if (!response.ok) {
                                        throw new Error(`Failed to get document URL: ${response.statusText}`);
                                      }
                                      
                                      const data = await response.json();
                                      
                                      // Open the presigned URL in new tab
                                      window.open(data.url, '_blank', 'noopener,noreferrer');
                                    } catch (error) {
                                      console.error('Error opening document:', error);
                                      toast({
                                        title: "Error",
                                        description: "Failed to open document. Please try again.",
                                        variant: "destructive",
                                      });
                                    }
                                  }
                                }}
                                data-testid={`button-view-doc-${docItem.key}`}
                              >
                                <Eye className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
                                View Document
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                    <CardTitle className="text-xs sm:text-sm">Receipts</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 px-3 sm:px-6">
                    {RECEIPT_CATEGORIES.map((receiptItem) => {
                      const receipts = getReceiptsForCategory(selectedShipment.documents || [], receiptItem.key);
                      return (
                        <div key={receiptItem.key} className="p-2 bg-muted/50 rounded-lg space-y-1.5" data-testid={`admin-receipt-${receiptItem.key}`}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <Package className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                              <span className="text-xs sm:text-sm truncate">{receiptItem.label}</span>
                            </div>
                            {receipts.length === 0 ? (
                              <Badge variant="outline" className="text-muted-foreground shrink-0 text-[10px] sm:text-xs">
                                Not Uploaded
                              </Badge>
                            ) : receipts.every((doc) => doc.isVerified) ? (
                              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 shrink-0 text-[10px] sm:text-xs">
                                <CheckCircle className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
                                Approved
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-yellow-600 dark:text-yellow-400 border-yellow-300 dark:border-yellow-700 shrink-0 text-[10px] sm:text-xs">
                                <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
                                {receipts.length} file{receipts.length === 1 ? "" : "s"}
                              </Badge>
                            )}
                          </div>
                          {receipts.map((doc, index) => (
                            <div key={doc.id} className="flex items-center gap-2 pl-0 sm:pl-6 flex-wrap">
                              <span className="text-[10px] sm:text-xs text-muted-foreground truncate max-w-[140px]">
                                {doc.fileName || `File ${index + 1}`}
                              </span>
                              {doc.fileUrl && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 sm:h-8 text-[10px] sm:text-xs px-2 sm:px-3"
                                  onClick={async () => {
                                    try {
                                      const response = await fetch(`/api/documents/presigned-url?path=${encodeURIComponent(doc.fileUrl!)}`, {
                                        credentials: "include",
                                      });
                                      if (!response.ok) {
                                        throw new Error(`Failed to get document URL: ${response.statusText}`);
                                      }
                                      const data = await response.json();
                                      window.open(data.url, "_blank", "noopener,noreferrer");
                                    } catch (error) {
                                      console.error("Error opening document:", error);
                                      toast({
                                        title: "Error",
                                        description: "Failed to open document. Please try again.",
                                        variant: "destructive",
                                      });
                                    }
                                  }}
                                  data-testid={`button-view-receipt-${receiptItem.key}-${index}`}
                                >
                                  <Eye className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
                                  View
                                </Button>
                              )}
                              {doc.fileUrl && !doc.isVerified && (
                                <Button
                                  size="sm"
                                  className="h-7 sm:h-8 text-[10px] sm:text-xs bg-green-600 text-white px-2 sm:px-3"
                                  onClick={() => {
                                    verifyDocumentMutation.mutate({ documentId: doc.id, isVerified: true });
                                  }}
                                  disabled={verifyDocumentMutation.isPending}
                                  data-testid={`button-approve-receipt-${receiptItem.key}-${index}`}
                                >
                                  <CheckCircle className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
                                  Approve
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>

                <Card data-testid="finance-review-card">
                  <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                    <CardTitle className="text-xs sm:text-sm flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Document Review
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 px-3 sm:px-6">
                    {selectedShipment.financeReview && (
                      <div className="text-xs sm:text-sm space-y-1 p-2 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-muted-foreground">Review Status:</span>
                          {(() => {
                            const config = reviewStatusConfig[selectedShipment.financeReview.status] || reviewStatusConfig.pending;
                            const Icon = config.icon;
                            return (
                              <Badge className={`text-[10px] sm:text-xs ${config.color}`}>
                                <Icon className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
                                {config.label}
                              </Badge>
                            );
                          })()}
                        </div>
                        {selectedShipment.financeReview.comment && (
                          <p className="break-words"><span className="text-muted-foreground">Comment:</span> {selectedShipment.financeReview.comment}</p>
                        )}
                        <p className="text-[10px] sm:text-xs text-muted-foreground">
                          By {selectedShipment.financeReview.reviewerName}
                          {selectedShipment.financeReview.reviewedAt && (
                            <> on {format(new Date(selectedShipment.financeReview.reviewedAt), "MMM d, yyyy 'at' h:mm a")}</>
                          )}
                        </p>
                      </div>
                    )}

                    <Textarea
                      placeholder="Add a comment for this finance decision..."
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      className="text-xs sm:text-sm min-h-[60px] sm:min-h-[80px]"
                      data-testid="input-review-comment"
                    />

                    <div className="flex gap-2 flex-wrap">
                      <Button
                        size="sm"
                        className="bg-green-600 text-white h-8 sm:h-9 text-[10px] sm:text-xs px-2 sm:px-3"
                        onClick={() => handleReview("approved")}
                        disabled={reviewMutation.isPending}
                        data-testid="button-approve"
                      >
                        <CheckCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        className="bg-orange-500 text-white h-8 sm:h-9 text-[10px] sm:text-xs px-2 sm:px-3"
                        onClick={() => handleReview("on_hold")}
                        disabled={reviewMutation.isPending}
                        data-testid="button-hold"
                      >
                        <PauseCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1" />
                        Hold
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-8 sm:h-9 text-[10px] sm:text-xs px-2 sm:px-3"
                        onClick={() => handleReview("rejected")}
                        disabled={reviewMutation.isPending}
                        data-testid="button-reject"
                      >
                        <XCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1" />
                        Reject
                      </Button>
                    </div>

                    {selectedShipment.financeReview?.status === "approved" && (
                      <div className="pt-2 border-t space-y-2">
                        <p className="text-xs sm:text-sm font-medium flex items-center gap-1">
                          <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Payment Status
                        </p>
                        <div className="flex items-center gap-2">
                          {selectedShipment.financeReview.paymentStatus === "released" ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                              <CheckCircle className="h-3 w-3" />
                              Released
                            </span>
                          ) : selectedShipment.financeReview.paymentStatus === "processing" ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                              <Clock className="h-3 w-3" />
                              Processing
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              Not Released
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="shipper" className="p-3 sm:p-4 space-y-3 sm:space-y-4 mt-0">
                <Card>
                  <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                    <CardTitle className="text-xs sm:text-sm flex items-center gap-2">
                      <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      Company Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs sm:text-sm px-3 sm:px-6">
                    <p className="font-medium text-sm sm:text-base break-words">{selectedShipment.shipper?.companyName || "N/A"}</p>
                    <p className="break-words"><span className="text-muted-foreground">Contact:</span> {selectedShipment.shipper?.contactName || "N/A"}</p>
                    {selectedShipment.shipper?.phone && (
                      <p className="flex items-center gap-2">
                        <Phone className="h-3 w-3 flex-shrink-0" />
                        <span className="break-all">{selectedShipment.shipper.phone}</span>
                      </p>
                    )}
                    {selectedShipment.shipper?.email && (
                      <p className="flex items-center gap-2">
                        <Mail className="h-3 w-3 flex-shrink-0" />
                        <span className="break-all">{selectedShipment.shipper.email}</span>
                      </p>
                    )}
                    {selectedShipment.shipper?.address && (
                      <p className="flex items-start gap-2">
                        <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        <span className="break-words">{selectedShipment.shipper.address}</span>
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="receiver" className="p-3 sm:p-4 space-y-3 sm:space-y-4 mt-0">
                <Card>
                  <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                    <CardTitle className="text-xs sm:text-sm flex items-center gap-2">
                      <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      Receiver Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs sm:text-sm px-3 sm:px-6">
                    <p className="font-medium text-sm sm:text-base break-words">{selectedShipment.receiver?.name || selectedShipment.receiver?.businessName || "N/A"}</p>
                    {selectedShipment.receiver?.businessName && selectedShipment.receiver?.name && (
                      <p className="break-words"><span className="text-muted-foreground">Business:</span> {selectedShipment.receiver.businessName}</p>
                    )}
                    {selectedShipment.receiver?.phone && (
                      <p className="flex items-center gap-2">
                        <Phone className="h-3 w-3 flex-shrink-0" />
                        <span className="break-all">{selectedShipment.receiver.phone}</span>
                      </p>
                    )}
                    {selectedShipment.receiver?.email && (
                      <p className="flex items-center gap-2">
                        <Mail className="h-3 w-3 flex-shrink-0" />
                        <span className="break-all">{selectedShipment.receiver.email}</span>
                      </p>
                    )}
                    {(selectedShipment.receiver?.address || selectedShipment.receiver?.city) && (
                      <p className="flex items-start gap-2">
                        <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        <span className="break-words">{[selectedShipment.receiver?.address, selectedShipment.receiver?.city].filter(Boolean).join(", ")}</span>
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="carrier" className="p-3 sm:p-4 space-y-3 sm:space-y-4 mt-0">
                <Card>
                  <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                    <CardTitle className="text-xs sm:text-sm flex items-center gap-2">
                      <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      Carrier Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs sm:text-sm px-3 sm:px-6">
                    <p className="font-medium text-sm sm:text-base break-words">{selectedShipment.carrier?.companyName || "N/A"}</p>
                    <p>
                      <span className="text-muted-foreground">Type:</span>{" "}
                      <Badge variant="outline" className="ml-1 text-[10px] sm:text-xs">
                        {selectedShipment.carrier?.carrierType === "solo" ? "Solo Operator" : "Fleet/Company"}
                      </Badge>
                    </p>
                    {selectedShipment.carrier?.phone && (
                      <p className="flex items-center gap-2">
                        <Phone className="h-3 w-3 flex-shrink-0" />
                        <span className="break-all">{selectedShipment.carrier.phone}</span>
                      </p>
                    )}
                  </CardContent>
                </Card>

                {selectedShipment.driver && (
                  <Card>
                    <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                      <CardTitle className="text-xs sm:text-sm flex items-center gap-2">
                        <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        Driver Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs sm:text-sm px-3 sm:px-6">
                      <p className="font-medium break-words">{selectedShipment.driver.name}</p>
                      {selectedShipment.driver.phone && (
                        <p className="flex items-center gap-2">
                          <Phone className="h-3 w-3 flex-shrink-0" />
                          <span className="break-all">{selectedShipment.driver.phone}</span>
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}

                {selectedShipment.truck && (
                  <Card>
                    <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                      <CardTitle className="text-xs sm:text-sm flex items-center gap-2">
                        <Truck className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        Truck Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1 text-xs sm:text-sm px-3 sm:px-6">
                      <p className="break-words"><span className="text-muted-foreground">Registration:</span> {selectedShipment.truck.registrationNumber}</p>
                      <p className="break-words"><span className="text-muted-foreground">Type:</span> {selectedShipment.truck.truckType?.replace(/_/g, " ") || "N/A"}</p>
                      <p><span className="text-muted-foreground">Capacity:</span> {selectedShipment.truck.capacity} MT</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>
          </div>{/* end mobile scroll wrapper */}
        </div>
      )}
    </div>
  );
}
