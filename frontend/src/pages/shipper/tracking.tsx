import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { onMarketplaceEvent } from "@/lib/marketplace-socket";
import { useToast } from "@/hooks/use-toast";
import { 
  MapPin, Package, Truck, CheckCircle, Clock, FileText, 
  Navigation, Building, ArrowRight, RefreshCw, Loader2,
  Eye, X, Download, Calendar, Bell, Maximize2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/empty-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { getDocumentUrl } from "@/lib/document-utils";
import { buildFullAddress } from "@/lib/address-utils";
import { geocodeAddress } from "@/lib/intutrack-api";
import { getTriptrackRouteVisualization, type TriptrackPointInput } from "@/lib/triptrack-route";
import { TriptrackRoutePolylineLayer, HaltFlagMarkers } from "@/components/map-trip-visual";
import { format, addHours, differenceInHours } from "date-fns";
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default icon issue with bundlers
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl,
  iconRetinaUrl,
  shadowUrl,
});

type ShipmentStage = "load_created" | "carrier_assigned" | "reached_pickup" | "loaded" | "in_transit" | "arrived_at_drop" | "delivered";

interface TimelineEvent {
  stage: ShipmentStage;
  completed: boolean;
  timestamp: string | null;
  location: string;
}

interface TrackedShipment {
  id: string;
  loadId: string;
  carrierId: string;
  status: string;
  progress: number;
  currentStage: string;
  eta: string | null;
  createdAt: string;
  startOtpRequested: boolean;
  startOtpVerified: boolean;
  endOtpRequested: boolean;
  endOtpVerified: boolean;
  load: {
    id: string;
    shipperLoadNumber: number | null;
    adminReferenceNumber: number | null;
    pickupCity: string;
    pickupAddress: string;
    pickupState?: string;
    pickupLat?: string | null;
    pickupLng?: string | null;
    pickupDate?: string | null;
    dropoffCity: string;
    dropoffAddress: string;
    dropoffState?: string;
    dropoffLat?: string | null;
    dropoffLng?: string | null;
    materialType: string;
    weight: string;
    requiredTruckType: string;
    triptrackLocations?: TriptrackPointInput[] | null;
  } | null;
  carrier: {
    id: string;
    username: string;
    companyName: string;
    phone: string | null;
    carrierType: 'solo' | 'enterprise';
    tripsCompleted: number;
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
  documents: Array<{
    id: string;
    documentType: string;
    status: string;
    fileName: string;
    fileUrl: string | null;
  }>;
  timeline: TimelineEvent[];
}

const stageLabels: Record<ShipmentStage, string> = {
  load_created: "Load Created",
  carrier_assigned: "Carrier Assigned",
  reached_pickup: "Reached Pickup",
  loaded: "Loaded",
  in_transit: "In Transit",
  arrived_at_drop: "Arrived at Drop",
  delivered: "Delivered",
};

const stageIcons: Record<ShipmentStage, typeof MapPin> = {
  load_created: FileText,
  carrier_assigned: Truck,
  reached_pickup: Building,
  loaded: Package,
  in_transit: Navigation,
  arrived_at_drop: MapPin,
  delivered: CheckCircle,
};

// City coordinates database - matching carrier page format
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
  "Surat": { lat: 21.1702, lng: 72.8311 },
  "Prayagraj": { lat: 25.4358, lng: 81.8463 },
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

function createPickupIcon() {
  return new L.DivIcon({
    className: 'custom-marker',
    html: `<div style="background: #22c55e; border: 2px solid white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><circle cx="12" cy="12" r="3"/></svg>
    </div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

function createDropoffIcon() {
  return new L.DivIcon({
    className: 'custom-marker',
    html: `<div style="background: #ef4444; border: 2px solid white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/></svg>
    </div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
  });
}

function createTruckIcon() {
  return new L.DivIcon({
    className: 'truck-marker',
    html: `<div style="background: #3b82f6; border: 2px solid white; border-radius: 8px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.4);">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

function FitBounds({ bounds }: { bounds: L.LatLngBoundsExpression }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(bounds, { padding: [30, 30] });
  }, [map, bounds]);
  return null;
}

interface ShipmentMapProps {
  shipment: TrackedShipment;
  onExpand?: () => void;
  isFullscreen?: boolean;
}

function ShipmentMap({ shipment, onExpand, isFullscreen = false }: ShipmentMapProps) {
  const load = shipment.load;
  const [geocodedPickup, setGeocodedPickup] = useState<{ lat: number; lng: number } | null>(null);
  const [geocodedDropoff, setGeocodedDropoff] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!load) return;
    if (!load.pickupLat || !load.pickupLng) {
      const full = buildFullAddress(load as any, "pickup");
      if (full) {
        let c = false;
        geocodeAddress(full).then((coords) => {
          if (!c && coords) setGeocodedPickup(coords);
          else if (!c) setGeocodedPickup(null);
        });
        return () => { c = true; };
      }
      setGeocodedPickup(null);
    } else setGeocodedPickup(null);
  }, [load?.id, load?.pickupAddress, load?.pickupCity, load?.pickupLat, load?.pickupLng]);

  useEffect(() => {
    if (!load) return;
    if (!load.dropoffLat || !load.dropoffLng) {
      const full = buildFullAddress(load as any, "dropoff");
      if (full) {
        let c = false;
        geocodeAddress(full).then((coords) => {
          if (!c && coords) setGeocodedDropoff(coords);
          else if (!c) setGeocodedDropoff(null);
        });
        return () => { c = true; };
      }
      setGeocodedDropoff(null);
    } else setGeocodedDropoff(null);
  }, [load?.id, load?.dropoffAddress, load?.dropoffCity, load?.dropoffLat, load?.dropoffLng]);

  const pickupIcon = useMemo(() => createPickupIcon(), []);
  const dropoffIcon = useMemo(() => createDropoffIcon(), []);
  const truckIcon = useMemo(() => createTruckIcon(), []);

  if (!load) return null;

  const pickupCoords = load.pickupLat && load.pickupLng
    ? { lat: parseFloat(load.pickupLat), lng: parseFloat(load.pickupLng) }
    : (geocodedPickup ?? getCityCoordinates(load.pickupCity));

  const dropoffCoords = load.dropoffLat && load.dropoffLng
    ? { lat: parseFloat(load.dropoffLat), lng: parseFloat(load.dropoffLng) }
    : (geocodedDropoff ?? getCityCoordinates(load.dropoffCity));

  // Triptrack points are available even if city-based coordinates are missing
  const tripPoints = (load.triptrackLocations || []).filter(
    (p): p is TriptrackPointInput => typeof p?.lat === "number" && typeof p?.lng === "number"
  );
  const triptrackViz = useMemo(() => getTriptrackRouteVisualization(tripPoints), [tripPoints]);

  if (!pickupCoords && !dropoffCoords && tripPoints.length === 0) {
    const indiaCenter: [number, number] = [22.5, 78.9];
    return (
      <div 
        className={`relative isolate ${isFullscreen ? 'h-[70vh]' : 'aspect-video'} rounded-lg overflow-hidden ${!isFullscreen && onExpand ? 'cursor-pointer' : ''}`}
        onClick={!isFullscreen && onExpand ? onExpand : undefined}
        data-testid="map-container"
      >
        <MapContainer
          center={indiaCenter}
          zoom={5}
          style={{ height: '100%', width: '100%', pointerEvents: isFullscreen ? 'auto' : 'none' }}
          scrollWheelZoom={isFullscreen}
          zoomControl={isFullscreen}
          dragging={isFullscreen}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        </MapContainer>
        <div className="absolute bottom-2 left-2 z-[1000] bg-background/80 backdrop-blur-sm rounded-md px-2 py-1 text-xs text-muted-foreground">
          Awaiting location data
        </div>
        {!isFullscreen && onExpand && (
          <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-black/0 hover:bg-black/10 transition-colors">
            <div className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm rounded-md p-1.5 flex items-center gap-1 text-xs text-muted-foreground">
              <Maximize2 className="h-3 w-3" />
              Click to expand
            </div>
          </div>
        )}
      </div>
    );
  }
  const isInTransit = shipment.currentStage === "in_transit";
  const isDelivered = shipment.currentStage === "delivered";
  const progress = shipment.progress / 100;

  const routePositions: [number, number][] = [];
  if (pickupCoords) routePositions.push([pickupCoords.lat, pickupCoords.lng]);
  for (const p of triptrackViz.triptrackPolyline) routePositions.push(p);
  if (isDelivered && dropoffCoords) routePositions.push([dropoffCoords.lat, dropoffCoords.lng]);

  const truckPosition: [number, number] =
    isDelivered && dropoffCoords
      ? [dropoffCoords.lat, dropoffCoords.lng]
      : tripPoints.length > 0
        ? [tripPoints[tripPoints.length - 1].lat, tripPoints[tripPoints.length - 1].lng]
        : pickupCoords && dropoffCoords
        ? [
            pickupCoords.lat + (dropoffCoords.lat - pickupCoords.lat) * progress,
            pickupCoords.lng + (dropoffCoords.lng - pickupCoords.lng) * progress,
          ]
        : pickupCoords
          ? [pickupCoords.lat, pickupCoords.lng]
          : dropoffCoords
            ? [dropoffCoords.lat, dropoffCoords.lng]
            : [22.5, 78.9];

  const pickupPos: [number, number] | null = pickupCoords ? [pickupCoords.lat, pickupCoords.lng] : null;
  const dropoffPos: [number, number] | null = dropoffCoords ? [dropoffCoords.lat, dropoffCoords.lng] : null;
  const fallbackCenter: [number, number] = [22.5, 78.9];
  const boundsPoints: [number, number][] = [];
  if (pickupPos) boundsPoints.push(pickupPos);
  if (dropoffPos) boundsPoints.push(dropoffPos);
  if (routePositions.length > 0) {
    routePositions.forEach((p) => {
      if (!boundsPoints.some((b) => b[0] === p[0] && b[1] === p[1])) boundsPoints.push(p);
    });
  }
  triptrackViz.halts.forEach((h) => {
    if (!boundsPoints.some((b) => b[0] === h.position[0] && b[1] === h.position[1])) boundsPoints.push(h.position);
  });
  const bounds: L.LatLngBoundsExpression = boundsPoints.length >= 2 ? boundsPoints : boundsPoints.length === 1 ? [boundsPoints[0], boundsPoints[0]] : [fallbackCenter, fallbackCenter];
  // Show triptrack route whenever we have route data (pickup + any points + optional drop)
  const showTriptrackRoute = routePositions.length > 1;

  const mapCenter: [number, number] = pickupPos && dropoffPos
    ? [(pickupPos[0] + dropoffPos[0]) / 2, (pickupPos[1] + dropoffPos[1]) / 2]
    : pickupPos ?? dropoffPos ?? fallbackCenter;

  return (
    <div 
      className={`relative isolate ${isFullscreen ? 'h-[70vh]' : 'aspect-video'} rounded-lg overflow-hidden ${!isFullscreen && onExpand ? 'cursor-pointer' : ''}`}
      onClick={!isFullscreen && onExpand ? onExpand : undefined}
      data-testid="map-container"
    >
      <MapContainer
        center={mapCenter}
        zoom={6}
        style={{ height: '100%', width: '100%', pointerEvents: isFullscreen ? 'auto' : 'none' }}
        scrollWheelZoom={isFullscreen}
        zoomControl={isFullscreen}
        dragging={isFullscreen}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds bounds={bounds} />
        
        {!showTriptrackRoute && pickupPos && dropoffPos && (
          <Polyline positions={[pickupPos, dropoffPos]} color="#94a3b8" weight={4} dashArray="10, 10" opacity={0.6} />
        )}
        {showTriptrackRoute && <TriptrackRoutePolylineLayer positions={routePositions} color="#22c55e" weight={4} opacity={0.9} />}
        {showTriptrackRoute && <HaltFlagMarkers halts={triptrackViz.halts} />}
        
        {pickupPos && (
          <Marker position={pickupPos} icon={pickupIcon}>
            <Popup>
              <strong>Pickup</strong><br/>
              {load.pickupCity}
            </Popup>
          </Marker>
        )}
        
        {dropoffPos && (
          <Marker position={dropoffPos} icon={dropoffIcon}>
            <Popup>
              <strong>Dropoff</strong><br/>
              {load.dropoffCity}
            </Popup>
          </Marker>
        )}
        
        {(tripPoints.length > 0 || progress > 0 || isDelivered) && (
          <Marker position={truckPosition} icon={truckIcon}>
            <Popup>
              <strong>{isDelivered ? "Final position" : "Truck in transit"}</strong><br/>
              {shipment.truck?.registrationNumber || 'Unknown'}<br/>
              Progress: {shipment.progress}%
            </Popup>
          </Marker>
        )}
      </MapContainer>
      
      {!isFullscreen && onExpand && (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-black/0 hover:bg-black/10 transition-colors">
          <div className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm rounded-md p-1.5 flex items-center gap-1 text-xs text-muted-foreground">
            <Maximize2 className="h-3 w-3" />
            Click to expand
          </div>
        </div>
      )}
    </div>
  );
}

function calculateETA(shipment: TrackedShipment): { date: string; time: string } | null {
  if (shipment.currentStage === "delivered") {
    const deliveredEvent = shipment.timeline.find(e => e.stage === "delivered" && e.timestamp);
    if (deliveredEvent?.timestamp) {
      const dt = new Date(deliveredEvent.timestamp);
      return {
        date: format(dt, "MMM d, yyyy"),
        time: format(dt, "h:mm a"),
      };
    }
    return null;
  }
  
  if (shipment.eta) {
    const etaDate = new Date(shipment.eta);
    return {
      date: format(etaDate, "MMM d, yyyy"),
      time: format(etaDate, "h:mm a"),
    };
  }
  
  const inTransitEvent = shipment.timeline.find(e => e.stage === "in_transit" && e.timestamp);
  if (inTransitEvent?.timestamp) {
    const estimatedArrival = addHours(new Date(inTransitEvent.timestamp), 12);
    return {
      date: format(estimatedArrival, "MMM d, yyyy"),
      time: format(estimatedArrival, "h:mm a"),
    };
  }
  
  const loadedEvent = shipment.timeline.find(e => e.stage === "loaded" && e.timestamp);
  if (loadedEvent?.timestamp) {
    const estimatedArrival = addHours(new Date(loadedEvent.timestamp), 14);
    return {
      date: format(estimatedArrival, "MMM d, yyyy"),
      time: format(estimatedArrival, "h:mm a"),
    };
  }
  
  return null;
}

function getStatusBadge(stage: string) {
  if (stage === "delivered") {
    return (
      <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 no-default-hover-elevate no-default-active-elevate">
        <CheckCircle className="h-3 w-3 mr-1" />
        Delivered
      </Badge>
    );
  }
  if (stage === "in_transit") {
    return (
      <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 no-default-hover-elevate no-default-active-elevate">
        <Truck className="h-3 w-3 mr-1" />
        In Transit
      </Badge>
    );
  }
  return (
    <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 no-default-hover-elevate no-default-active-elevate">
      <Clock className="h-3 w-3 mr-1" />
      Active
    </Badge>
  );
}

function formatLoadId(shipperLoadNumber: number | null | undefined, adminReferenceNumber: number | null | undefined): string {
  if (adminReferenceNumber) {
    return `LD-${String(adminReferenceNumber).padStart(3, '0')}`;
  }
  if (shipperLoadNumber) {
    return `LD-${String(shipperLoadNumber).padStart(3, '0')}`;
  }
  return "LD-XXX";
}

const documentTypeToLabel: Record<string, string> = {
  lr_consignment: "LR / Consignment Note",
  eway_bill: "E-way Bill",
  loading_photos: "Loading Photos",
  pod: "Proof of Delivery (POD)",
  invoice: "Invoice",
  other: "Other Document",
};

export default function TrackingPage() {
  const { toast } = useToast();
  const { data: shipments = [], isLoading, refetch, isFetching } = useQuery<TrackedShipment[]>({
    queryKey: ['/api/shipments/tracking'],
    refetchInterval: 30000,
  });

  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null);
  const [documentViewerOpen, setDocumentViewerOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<{ type: string; image: string } | null>(null);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const initialTab = (() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab === "in_transit" || tab === "active") return tab;
    return "all";
  })();
  const [shipmentFilter, setShipmentFilter] = useState<"all" | "active" | "in_transit">(initialTab);

  const allActiveShipments = shipments.filter(s => s.currentStage !== "delivered");
  const activeOnlyShipments = shipments.filter(s => 
    ["load_created", "carrier_assigned", "reached_pickup", "loaded"].includes(s.currentStage)
  );
  const inTransitShipments = shipments.filter(s => 
    ["in_transit", "arrived_at_drop"].includes(s.currentStage)
  );
  
  const activeShipments = shipmentFilter === "active" 
    ? activeOnlyShipments 
    : shipmentFilter === "in_transit" 
      ? inTransitShipments 
      : allActiveShipments;
  const selectedShipment = shipments.find(s => s.id === selectedShipmentId) || activeShipments[0] || null;
  const estimatedArrival = selectedShipment ? calculateETA(selectedShipment) : null;

  useEffect(() => {
    const unsubDocumentUploaded = onMarketplaceEvent("shipment_document_uploaded", (data: any) => {
      const docType = data?.document?.documentType || data?.documentType;
      const docLabel = documentTypeToLabel[docType] || docType || "Document";
      toast({
        title: "New Document Received",
        description: `Carrier uploaded: ${docLabel}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/shipments/tracking"] });
    });
    
    return () => {
      unsubDocumentUploaded();
    };
  }, [toast]);

  function openDocumentViewer(docLabel: string, docKey: string) {
    const doc = selectedShipment?.documents.find(d => d.documentType === docKey);
    if (doc && doc.fileUrl) {
      setSelectedDocument({ type: docLabel, image: doc.fileUrl });
      setDocumentViewerOpen(true);
    } else {
      toast({ 
        title: "Document Not Available", 
        description: doc ? "Document file is being processed" : "This document hasn't been uploaded yet"
      });
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (allActiveShipments.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Track Shipments</h1>
        <EmptyState
          icon={MapPin}
          title="No active shipments"
          description="All your shipments have been delivered. Check the Delivered Loads page for completed deliveries."
        />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 sm:mb-4 gap-3 sm:gap-4">
        <div>
          <h1 className="text-lg sm:text-xl font-bold">Track Shipments</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Monitor your active shipments in real-time.</p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => refetch()}
          disabled={isFetching}
          data-testid="button-refresh-tracking"
          className="w-full sm:w-auto"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-3 sm:gap-4 grid-cols-1 lg:grid-cols-[320px_1fr]">
        <Card className="lg:overflow-hidden lg:flex lg:flex-col lg:min-h-0 lg:h-[calc(100vh-160px)]">
          <CardHeader className="pb-2 lg:flex-shrink-0 space-y-2 sm:space-y-3">
            <CardTitle className="text-sm">Shipments</CardTitle>
            <Tabs value={shipmentFilter} onValueChange={(v) => setShipmentFilter(v as "all" | "active" | "in_transit")} className="w-full">
              <TabsList className="w-full grid grid-cols-3 h-9">
                <TabsTrigger value="all" className="text-xs" data-testid="tab-all-shipments">
                  All ({allActiveShipments.length})
                </TabsTrigger>
                <TabsTrigger value="active" className="text-xs" data-testid="tab-active-shipments">
                  Active ({activeOnlyShipments.length})
                </TabsTrigger>
                <TabsTrigger value="in_transit" className="text-xs" data-testid="tab-in-transit-shipments">
                  In Transit ({inTransitShipments.length})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="p-2 lg:p-0 lg:flex-1 lg:min-h-0">
            <ScrollArea className="lg:h-full">
              <div className="lg:p-2 space-y-2">
                {activeShipments.map((shipment) => (
                  <div
                    key={shipment.id}
                    className={`p-2.5 sm:p-3 rounded-lg cursor-pointer hover-elevate ${
                      selectedShipment?.id === shipment.id 
                        ? "bg-primary/10 border border-primary/20" 
                        : "bg-muted/50"
                    }`}
                    onClick={() => setSelectedShipmentId(shipment.id)}
                    data-testid={`shipment-item-${shipment.id}`}
                  >
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <span className="text-xs text-muted-foreground">
                        Load {formatLoadId(shipment.load?.shipperLoadNumber, shipment.load?.adminReferenceNumber)}
                      </span>
                      {getStatusBadge(shipment.currentStage)}
                    </div>
                    <p className="font-medium text-xs sm:text-sm mb-1 break-words">
                      {shipment.load?.pickupCity || "Origin"} to {shipment.load?.dropoffCity || "Destination"}
                    </p>
                    {shipment.load?.pickupDate && (
                      <div className="flex items-center gap-1.5 mb-2">
                        <Badge variant="outline" className="text-xs px-2 py-0.5 bg-primary/10 border-primary/30 text-primary">
                          <Calendar className="h-3 w-3 mr-1 shrink-0" />
                          <span className="truncate">{format(new Date(shipment.load.pickupDate), "MMM d, yyyy")}</span>
                        </Badge>
                      </div>
                    )}
                    <Progress value={shipment.progress} className="h-2 mb-2" />
                    <div className="flex items-center justify-between text-xs text-muted-foreground gap-2 flex-wrap">
                      <span className="truncate">{shipment.carrier?.companyName || "Carrier"}</span>
                      {shipment.eta && (
                        <span className="flex items-center gap-1 shrink-0">
                          <Clock className="h-3 w-3" />
                          ETA: {format(new Date(shipment.eta), "h:mm a")}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                      <FileText className="h-3 w-3 shrink-0" />
                      <span>{shipment.documents.length} docs</span>
                      <Badge variant="secondary" className="text-xs py-0">
                        {shipment.documents.length}/4 uploaded
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="lg:overflow-hidden lg:flex lg:flex-col lg:min-h-0 lg:h-[calc(100vh-160px)]">
          {selectedShipment ? (
            <>
              <CardHeader className="pb-3 border-b border-border lg:flex-shrink-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                  <div className="min-w-0">
                    <CardTitle className="text-base sm:text-lg break-words">
                      {selectedShipment.load?.pickupCity || "Origin"} to {selectedShipment.load?.dropoffCity || "Destination"}
                    </CardTitle>
                    <div className="flex items-center gap-2 sm:gap-4 mt-2 text-xs sm:text-sm text-muted-foreground flex-wrap">
                      <span className="font-medium truncate">{selectedShipment.carrier?.companyName}</span>
                      {selectedShipment.truck && (
                        <span className="truncate">
                          {selectedShipment.truck.truckType} - {selectedShipment.truck.registrationNumber}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-left sm:text-right shrink-0">
                    <p className="text-xs sm:text-sm text-muted-foreground flex items-center sm:justify-end gap-1">
                      <Calendar className="h-3 w-3 shrink-0" />
                      {selectedShipment.currentStage === "delivered" ? "Delivered" : "Estimated Arrival"}
                    </p>
                    {estimatedArrival ? (
                      <div>
                        <p className="font-semibold text-base sm:text-lg" data-testid="text-eta-date">{estimatedArrival.date}</p>
                        <p className="text-xs sm:text-sm text-muted-foreground" data-testid="text-eta-time">{estimatedArrival.time}</p>
                      </div>
                    ) : (
                      <p className="font-semibold text-muted-foreground">Pending</p>
                    )}
                  </div>
                </div>
                <Progress value={selectedShipment.progress} className="mt-4" />
              </CardHeader>
              <CardContent className="p-2 sm:p-3 lg:p-0 lg:flex-1 lg:min-h-0 lg:overflow-auto">
                <div className="lg:p-3 grid gap-4 sm:gap-6 lg:grid-cols-2">
                  <div>
                    <h3 className="font-semibold text-sm sm:text-base mb-3 sm:mb-4">Shipment Timeline</h3>
                    <div className="relative">
                      {selectedShipment.timeline.map((event, index) => {
                        const Icon = stageIcons[event.stage as ShipmentStage] || MapPin;
                        const isLast = index === selectedShipment.timeline.length - 1;
                        return (
                          <div key={event.stage} className="flex gap-3 sm:gap-4 pb-4 sm:pb-6 last:pb-0">
                            <div className="relative flex flex-col items-center">
                              <div className={`flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full shrink-0 ${
                                event.completed 
                                  ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" 
                                  : "bg-muted text-muted-foreground"
                              }`}>
                                <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                              </div>
                              {!isLast && (
                                <div className={`w-0.5 flex-1 mt-2 ${
                                  event.completed ? "bg-green-200 dark:bg-green-800" : "bg-border"
                                }`} />
                              )}
                            </div>
                            <div className="flex-1 pt-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <p className={`font-medium text-xs sm:text-sm break-words ${!event.completed && "text-muted-foreground"}`}>
                                  {stageLabels[event.stage as ShipmentStage] || event.stage}
                                </p>
                                {event.completed && (
                                  <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-500 shrink-0" />
                                )}
                              </div>
                              <p className="text-xs sm:text-sm text-muted-foreground break-words">{event.location}</p>
                              {event.timestamp && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {format(new Date(event.timestamp), "MMM d 'at' h:mm a")}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-sm sm:text-base mb-3 sm:mb-4">Live Map</h3>
                    <div className="mb-4 sm:mb-6">
                      <ShipmentMap 
                        shipment={selectedShipment} 
                        onExpand={() => setMapFullscreen(true)}
                      />
                    </div>

                    <h3 className="font-semibold text-sm sm:text-base mb-3 sm:mb-4">Carrier & Truck Details</h3>
                    <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
                      {selectedShipment.carrier?.carrierType === 'solo' ? (
                        <>
                          <div className="flex items-center justify-between text-xs sm:text-sm gap-2">
                            <span className="text-muted-foreground">Driver</span>
                            <span className="font-medium text-right break-words">{selectedShipment.driver?.name || selectedShipment.carrier?.username || "N/A"}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs sm:text-sm gap-2">
                            <span className="text-muted-foreground">Trips Done</span>
                            <span className="font-medium">{selectedShipment.carrier?.tripsCompleted || 0}</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center justify-between text-xs sm:text-sm gap-2">
                            <span className="text-muted-foreground">Company</span>
                            <span className="font-medium text-right break-words">{selectedShipment.carrier?.companyName || "N/A"}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs sm:text-sm gap-2">
                            <span className="text-muted-foreground">Driver</span>
                            <span className="font-medium text-right break-words">{selectedShipment.driver?.name || "Pending assignment"}</span>
                          </div>
                        </>
                      )}
                      {selectedShipment.truck ? (
                        <>
                          <div className="flex items-center justify-between text-xs sm:text-sm gap-2">
                            <span className="text-muted-foreground">Vehicle</span>
                            <span className="font-medium text-right break-words">{selectedShipment.truck.truckType}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs sm:text-sm gap-2">
                            <span className="text-muted-foreground">Truck No.</span>
                            <span className="font-medium break-all">{selectedShipment.truck.registrationNumber}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs sm:text-sm gap-2">
                            <span className="text-muted-foreground">Capacity</span>
                            <span className="font-medium">{selectedShipment.truck.capacity} tons</span>
                          </div>
                        </>
                      ) : (
                        <div className="p-2 sm:p-3 rounded-lg bg-muted/50 text-xs sm:text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Truck className="h-4 w-4 shrink-0" />
                            <span>Truck details will be available once the carrier assigns a vehicle</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between mb-3 sm:mb-4 gap-2">
                      <h3 className="font-semibold text-sm sm:text-base">Documents</h3>
                      {(() => {
                        const loadNum = selectedShipment.load?.adminReferenceNumber || selectedShipment.load?.shipperLoadNumber;
                        const loadId = loadNum ? `LD-${String(loadNum).padStart(3, '0')}` : '';
                        return (
                          <Link 
                            href={`/shipper/documents?load=${encodeURIComponent(loadId)}`}
                            className="text-xs text-primary hover:underline flex items-center gap-1"
                            data-testid="link-view-all-documents"
                          >
                            View All
                            <ArrowRight className="h-3 w-3" />
                          </Link>
                        );
                      })()}
                    </div>
                    <div className="space-y-2">
                      {[
                        { key: "lr_consignment", label: "LR / Consignment Note" },
                        { key: "eway_bill", label: "E-way Bill" },
                        { key: "loading_photos", label: "Loading Photos" },
                        { key: "pod", label: "Proof of Delivery (POD)" },
                      ].map((docItem) => {
                        const doc = selectedShipment.documents.find(d => 
                          d.documentType === docItem.key
                        );
                        return (
                          <div 
                            key={docItem.key} 
                            className="flex items-center justify-between p-2 sm:p-3 bg-muted/50 rounded-lg hover-elevate cursor-pointer gap-2"
                            onClick={() => openDocumentViewer(docItem.label, docItem.key)}
                            data-testid={`document-${docItem.key}`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="text-xs sm:text-sm truncate">{docItem.label}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {doc?.status === "verified" ? (
                                <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  <span className="hidden sm:inline">Verified</span>
                                </Badge>
                              ) : doc ? (
                                <Badge variant="secondary" className="text-xs">
                                  <ArrowRight className="h-3 w-3 mr-1" />
                                  <span className="hidden sm:inline">Uploaded</span>
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-muted-foreground text-xs">
                                  Pending
                                </Badge>
                              )}
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </CardContent>
            </>
          ) : (
            <CardContent className="h-full flex items-center justify-center">
              <p className="text-muted-foreground">Select a shipment to view details</p>
            </CardContent>
          )}
        </Card>
      </div>

      <Dialog open={documentViewerOpen} onOpenChange={setDocumentViewerOpen}>
        <DialogContent className="max-w-full sm:max-w-4xl max-h-[90vh] overflow-auto p-0">
          <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 border-b">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <FileText className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
              <span className="break-words">{selectedDocument?.type}</span>
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {selectedShipment && (
                <span className="break-words">
                  Load {formatLoadId(selectedShipment.load?.shipperLoadNumber, selectedShipment.load?.adminReferenceNumber)} - {selectedShipment.load?.pickupCity} to {selectedShipment.load?.dropoffCity}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          {selectedDocument && (
            <div className="px-4 sm:px-6 pb-4 sm:pb-6">
              <div className="border rounded-lg overflow-hidden bg-white dark:bg-slate-900">
                {(() => {
                  const url = getDocumentUrl(selectedDocument.image);
                  if (!url) return null;
                  const isPdf = selectedDocument.image.toLowerCase().endsWith(".pdf");
                  return isPdf ? (
                    <iframe
                      src={url}
                      className="w-full h-[50vh] sm:h-[60vh]"
                      title={selectedDocument.type}
                    />
                  ) : (
                    <img
                      src={url}
                      alt={selectedDocument.type}
                      className="w-full h-auto object-contain"
                      data-testid="img-document-viewer"
                    />
                  );
                })()}
              </div>
              <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    const url = getDocumentUrl(selectedDocument.image);
                    if (url) {
                      const link = document.createElement("a");
                      link.href = url;
                      const ext = selectedDocument.image.split(".").pop() || "file";
                      link.download = `${selectedDocument.type.replace(/[^a-z0-9]/gi, "_")}.${ext}`;
                      link.click();
                    }
                  }}
                  data-testid="button-download-document"
                  className="w-full sm:w-auto"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button 
                  size="sm"
                  onClick={() => setDocumentViewerOpen(false)}
                  data-testid="button-close-document"
                  className="w-full sm:w-auto"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={mapFullscreen} onOpenChange={setMapFullscreen}>
        <DialogContent className="max-w-full sm:max-w-6xl max-h-[90vh] p-0">
          <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 border-b">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Navigation className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
              Live Tracking Map
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {selectedShipment && (
                <span className="break-words">
                  {selectedShipment.load?.pickupCity} to {selectedShipment.load?.dropoffCity} - {selectedShipment.progress}% complete
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          {selectedShipment && (
            <div className="px-4 sm:px-6 pb-4 sm:pb-6">
              <ShipmentMap shipment={selectedShipment} isFullscreen={true} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
