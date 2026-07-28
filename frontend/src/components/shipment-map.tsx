import { useEffect, useState, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Truck, MapPin, Navigation, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { geocodeAddress } from "@/lib/intutrack-api";
import { getTriptrackRouteVisualization, type TriptrackPointInput } from "@/lib/triptrack-route";
import { TriptrackRoutePolylineLayer, HaltFlagMarkers } from "@/components/map-trip-visual";

const cityCoordinates: Record<string, { lat: number; lng: number }> = {
  "Mumbai": { lat: 19.0760, lng: 72.8777 },
  "Indore": { lat: 22.7196, lng: 75.8577 },
  "Delhi": { lat: 28.6139, lng: 77.2090 },
  "Bangalore": { lat: 12.9716, lng: 77.5946 },
  "Bengaluru": { lat: 12.9716, lng: 77.5946 },
  "Bengalore": { lat: 12.9716, lng: 77.5946 },
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
  "Maheshtala": { lat: 22.5112, lng: 88.2610 },
  "Pasighat": { lat: 28.0700, lng: 95.3300 },
  "Ponda": { lat: 15.4000, lng: 74.0000 },
  "Panaji": { lat: 15.4909, lng: 73.8278 },
  "Margao": { lat: 15.2832, lng: 73.9862 },
  "Vasco": { lat: 15.3982, lng: 73.8113 },
  "Itanagar": { lat: 27.0844, lng: 93.6053 },
  "Tezpur": { lat: 26.6338, lng: 92.8008 },
  "Dibrugarh": { lat: 27.4728, lng: 94.9120 },
  "Jorhat": { lat: 26.7465, lng: 94.2026 },
  "Silchar": { lat: 24.8333, lng: 92.7789 },
  "Imphal": { lat: 24.8170, lng: 93.9368 },
  "Shillong": { lat: 25.5788, lng: 91.8933 },
  "Aizawl": { lat: 23.7271, lng: 92.7176 },
  "Kohima": { lat: 25.6751, lng: 94.1086 },
  "Agartala": { lat: 23.8315, lng: 91.2868 },
  "Gangtok": { lat: 27.3389, lng: 88.6065 },
  "Port Blair": { lat: 11.6234, lng: 92.7265 },
  "Zirakpur": { lat: 30.6425, lng: 76.8173 },
  "Mohali": { lat: 30.7046, lng: 76.7179 },
  "Panchkula": { lat: 30.6942, lng: 76.8606 },
  "Shimla": { lat: 31.1048, lng: 77.1734 },
  "Dharamshala": { lat: 32.2190, lng: 76.3234 },
  "Manali": { lat: 32.2396, lng: 77.1887 },
  "Haridwar": { lat: 29.9457, lng: 78.1642 },
  "Rishikesh": { lat: 30.0869, lng: 78.2676 },
  "Nainital": { lat: 29.3919, lng: 79.4542 },
  "Mussoorie": { lat: 30.4598, lng: 78.0644 },
  "Mathura": { lat: 27.4924, lng: 77.6737 },
  "Vrindavan": { lat: 27.5814, lng: 77.6958 },
  "Ayodhya": { lat: 26.7922, lng: 82.1998 },
  "Prayagraj": { lat: 25.4358, lng: 81.8463 },
  "Bodh Gaya": { lat: 24.6961, lng: 84.9869 },
  "Darbhanga": { lat: 26.1542, lng: 85.8918 },
  "Muzaffarpur": { lat: 26.1197, lng: 85.3910 },
  "Bhagalpur": { lat: 25.2425, lng: 87.0086 },
  "Purnia": { lat: 25.7771, lng: 87.4699 },
  "Hazaribagh": { lat: 23.9925, lng: 85.3637 },
  "Bokaro": { lat: 23.6693, lng: 86.1511 },
  "Deoghar": { lat: 24.4764, lng: 86.6944 },
  "Sambalpur": { lat: 21.4669, lng: 83.9756 },
  "Berhampur": { lat: 19.3150, lng: 84.7941 },
  "Balasore": { lat: 21.4934, lng: 86.9135 },
  "Puri": { lat: 19.8135, lng: 85.8312 },
  "Konark": { lat: 19.8876, lng: 86.0945 },
  "Kharagpur": { lat: 22.3460, lng: 87.2320 },
  "Haldia": { lat: 22.0667, lng: 88.0698 },
  "Bardhaman": { lat: 23.2324, lng: 87.8615 },
  "Malda": { lat: 25.0108, lng: 88.1411 },
  "Krishnanagar": { lat: 23.4013, lng: 88.4883 },
  "Darjeeling": { lat: 27.0410, lng: 88.2663 },
  "Jalpaiguri": { lat: 26.5167, lng: 88.7333 },
  "Cooch Behar": { lat: 26.3452, lng: 89.4482 },
  "Raiganj": { lat: 25.6167, lng: 88.1333 },
  "Bankura": { lat: 23.2324, lng: 87.0649 },
  "Purulia": { lat: 23.3320, lng: 86.3650 },
  "Kalyani": { lat: 22.9750, lng: 88.4344 },
  "Santiniketan": { lat: 23.6833, lng: 87.6833 },
  "Digha": { lat: 21.6277, lng: 87.5093 },
  "Mandarmani": { lat: 21.6667, lng: 87.7167 },
  "Bakkhali": { lat: 21.5667, lng: 88.2500 },
  "Sundarbans": { lat: 21.9497, lng: 89.1833 },
};

// Common alternate spellings map
const cityAliases: Record<string, string> = {
  "bengaluru": "Bangalore",
  "bengalore": "Bangalore",
  "bombay": "Mumbai",
  "calcutta": "Kolkata",
  "madras": "Chennai",
  "trivandrum": "Thiruvananthapuram",
  "poona": "Pune",
  "baroda": "Vadodara",
  "vizag": "Visakhapatnam",
  "vishakhapatnam": "Visakhapatnam",
};

function getCityCoordinates(cityName: string): { lat: number; lng: number } | null {
  const trimmed = cityName.trim();
  
  // Exact match
  if (cityCoordinates[trimmed]) return cityCoordinates[trimmed];
  
  // Alias match (case-insensitive)
  const aliasKey = trimmed.toLowerCase();
  if (cityAliases[aliasKey]) return cityCoordinates[cityAliases[aliasKey]] ?? null;
  
  // Fuzzy match
  const cityKey = Object.keys(cityCoordinates).find(
    key => trimmed.toLowerCase().includes(key.toLowerCase()) ||
           key.toLowerCase().includes(trimmed.toLowerCase())
  );
  
  return cityKey ? cityCoordinates[cityKey] : null;
}

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

const truckIcon = L.divIcon({
  className: "truck-marker",
  html: `<div style="background: #3b82f6; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 2px 12px rgba(59,130,246,0.5); animation: pulse 2s infinite;">
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>
      <path d="M15 18H9"/>
      <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/>
      <circle cx="17" cy="18" r="2"/>
      <circle cx="7" cy="18" r="2"/>
    </svg>
  </div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  popupAnchor: [0, -20],
});

function MapBoundsUpdater({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length === 0) return;
    if (positions.length === 1) {
      map.setView(positions[0], 10);
      return;
    }
    const bounds = L.latLngBounds(positions.map((p) => L.latLng(p[0], p[1])));
    map.fitBounds(bounds, { padding: [50, 50] });
  }, [map, positions]);
  return null;
}

/** Recompute map size when container becomes visible (e.g. after switching to Map tab). Fixes blank map on some environments. */
function MapInvalidateSize() {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    const t1 = window.setTimeout(() => map.invalidateSize(), 100);
    const t2 = window.setTimeout(() => map.invalidateSize(), 400);
    const container = map.getContainer();
    const ro = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => map.invalidateSize())
      : null;
    if (ro && container) ro.observe(container);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      if (ro && container) ro.disconnect();
    };
  }, [map]);
  return null;
}

interface ShipmentMapProps {
  pickupCity: string;
  dropoffCity: string;
  /** Full address for accurate geocoding (Google API). When set, used instead of city-only position. */
  pickupAddressFull?: string | null;
  /** Full address for accurate geocoding (Google API). When set, used instead of city-only position. */
  dropoffAddressFull?: string | null;
  showTruck?: boolean;
  truckAtPickup?: boolean;
  progress?: number;
  /** When provided, truck is shown at last raw point and route is pickup → collapsed triptrack → (if delivered) drop */
  triptrackLocations?: TriptrackPointInput[] | null;
  /** e.g. "in_transit" | "delivered" - when "delivered", route line extends to drop */
  currentStage?: string;
  className?: string;
}

export function ShipmentMap({
  pickupCity,
  dropoffCity,
  pickupAddressFull = null,
  dropoffAddressFull = null,
  showTruck = false,
  truckAtPickup = true,
  progress = 0,
  triptrackLocations = null,
  currentStage,
  className = "",
}: ShipmentMapProps) {
  const cityPickup = useMemo(() => getCityCoordinates(pickupCity), [pickupCity]);
  const cityDropoff = useMemo(() => getCityCoordinates(dropoffCity), [dropoffCity]);

  const [geocodedPickup, setGeocodedPickup] = useState<{ lat: number; lng: number } | null>(null);
  const [geocodedDropoff, setGeocodedDropoff] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!pickupAddressFull?.trim()) {
      setGeocodedPickup(null);
      return;
    }
    let cancelled = false;
    geocodeAddress(pickupAddressFull.trim()).then((coords) => {
      if (!cancelled && coords) setGeocodedPickup(coords);
      else if (!cancelled) setGeocodedPickup(null);
    });
    return () => { cancelled = true; };
  }, [pickupAddressFull]);

  useEffect(() => {
    if (!dropoffAddressFull?.trim()) {
      setGeocodedDropoff(null);
      return;
    }
    let cancelled = false;
    geocodeAddress(dropoffAddressFull.trim()).then((coords) => {
      if (!cancelled && coords) setGeocodedDropoff(coords);
      else if (!cancelled) setGeocodedDropoff(null);
    });
    return () => { cancelled = true; };
  }, [dropoffAddressFull]);

  const pickupCoords = geocodedPickup ?? cityPickup;
  const dropoffCoords = geocodedDropoff ?? cityDropoff;

  const rawTripPoints = useMemo(
    () =>
      (triptrackLocations || []).filter(
        (p) => typeof p?.lat === "number" && typeof p?.lng === "number"
      ) as TriptrackPointInput[],
    [triptrackLocations]
  );

  const triptrackViz = useMemo(
    () => getTriptrackRouteVisualization(rawTripPoints),
    [rawTripPoints]
  );

  const truckPosition = useMemo(() => {
    if (!showTruck) return null;
    if (currentStage === "delivered" && dropoffCoords) {
      return { lat: dropoffCoords.lat, lng: dropoffCoords.lng };
    }
    if (rawTripPoints.length > 0) {
      const last = rawTripPoints[rawTripPoints.length - 1];
      return { lat: last.lat, lng: last.lng };
    }
    if (!pickupCoords || !dropoffCoords) return null;
    if (truckAtPickup || progress <= 0) return pickupCoords;
    const progressFraction = Math.min(100, Math.max(0, progress)) / 100;
    return {
      lat: pickupCoords.lat + (dropoffCoords.lat - pickupCoords.lat) * progressFraction,
      lng: pickupCoords.lng + (dropoffCoords.lng - pickupCoords.lng) * progressFraction,
    };
  }, [pickupCoords, dropoffCoords, showTruck, truckAtPickup, progress, rawTripPoints, currentStage]);

  const routePoints = useMemo((): [number, number][] => {
    if (!pickupCoords && triptrackViz.triptrackPolyline.length === 0) return [];
    const points: [number, number][] = [];
    if (pickupCoords) points.push([pickupCoords.lat, pickupCoords.lng]);
    for (const p of triptrackViz.triptrackPolyline) points.push(p);
    if (currentStage === "delivered" && dropoffCoords) points.push([dropoffCoords.lat, dropoffCoords.lng]);
    if (points.length === 0 && dropoffCoords) points.push([dropoffCoords.lat, dropoffCoords.lng]);
    return points;
  }, [pickupCoords, dropoffCoords, triptrackViz.triptrackPolyline, currentStage]);

  const boundsPositions = useMemo(() => {
    const all: [number, number][] = [...routePoints];
    for (const h of triptrackViz.halts) all.push(h.position);
    if (dropoffCoords && !routePoints.some((r) => r[0] === dropoffCoords!.lat && r[1] === dropoffCoords!.lng))
      all.push([dropoffCoords.lat, dropoffCoords.lng]);
    return all;
  }, [routePoints, dropoffCoords, triptrackViz.halts]);
  
  if (!pickupCoords && !dropoffCoords && rawTripPoints.length === 0) {
    return (
      <div className={`flex items-center justify-center bg-muted rounded-lg ${className}`} style={{ minHeight: 300 }}>
        <div className="text-center text-muted-foreground">
          <MapPin className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>Location coordinates not available</p>
          <p className="text-sm">{pickupCity} → {dropoffCity}</p>
        </div>
      </div>
    );
  }
  
  const defaultCenter =
    pickupCoords ||
    dropoffCoords ||
    (rawTripPoints.length > 0
      ? { lat: rawTripPoints[rawTripPoints.length - 1]!.lat, lng: rawTripPoints[rawTripPoints.length - 1]!.lng }
      : { lat: 20.5937, lng: 78.9629 });
  const isInTransit = currentStage === "in_transit";
  const isDelivered = currentStage === "delivered";
  const showTriptrackRoute = (isInTransit || isDelivered) && routePoints.length > 1;

  return (
    <div className={`relative isolate rounded-lg overflow-hidden ${className}`} style={{ minHeight: 300 }}>
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.9; }
        }
        .truck-marker { z-index: 999 !important; }
        .leaflet-container { height: 100%; min-height: 300px; }
      `}</style>
      
      <MapContainer
        center={[defaultCenter.lat, defaultCenter.lng]}
        zoom={6}
        style={{ height: "100%", width: "100%", minHeight: 300 }}
        scrollWheelZoom={true}
      >
        <MapInvalidateSize />
        {/* Fallback base layer (different CDN) so map still shows if OSM is blocked on some networks */}
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"
          zIndex={-1}
        />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapBoundsUpdater positions={boundsPositions.length > 0 ? boundsPositions : (pickupCoords && dropoffCoords ? [[pickupCoords.lat, pickupCoords.lng], [dropoffCoords.lat, dropoffCoords.lng]] : [])} />
        
        {showTriptrackRoute && <TriptrackRoutePolylineLayer positions={routePoints} color="#22c55e" weight={4} opacity={0.9} />}
        {showTriptrackRoute && <HaltFlagMarkers halts={triptrackViz.halts} />}
        {!showTriptrackRoute && pickupCoords && dropoffCoords && (
          <Polyline
            positions={[[pickupCoords.lat, pickupCoords.lng], [dropoffCoords.lat, dropoffCoords.lng]]}
            color="#3b82f6"
            weight={4}
            opacity={0.8}
            dashArray="10, 10"
          />
        )}
        
        {pickupCoords && (
          <Marker position={[pickupCoords.lat, pickupCoords.lng]} icon={pickupIcon}>
            <Popup>
              <div className="text-center">
                <p className="font-medium text-green-600">Pickup Location</p>
                <p className="text-sm">{pickupCity}</p>
              </div>
            </Popup>
          </Marker>
        )}
        
        {dropoffCoords && (
          <Marker position={[dropoffCoords.lat, dropoffCoords.lng]} icon={dropoffIcon}>
            <Popup>
              <div className="text-center">
                <p className="font-medium text-red-600">Dropoff Location</p>
                <p className="text-sm">{dropoffCity}</p>
              </div>
            </Popup>
          </Marker>
        )}
        
        {truckPosition && showTruck && (
          <Marker position={[truckPosition.lat, truckPosition.lng]} icon={truckIcon}>
            <Popup>
              <div className="text-center">
                <p className="font-medium text-blue-600">{isDelivered ? "Final position" : "Truck location"}</p>
                <p className="text-sm">Progress: {progress}%</p>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
      
      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-2 pointer-events-none">
        <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 pointer-events-auto">
          <MapPin className="h-3 w-3 mr-1" />
          {pickupCity}
        </Badge>
        <Navigation className="h-4 w-4 text-muted-foreground" />
        <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300 pointer-events-auto">
          <MapPin className="h-3 w-3 mr-1" />
          {dropoffCity}
        </Badge>
      </div>
    </div>
  );
}
