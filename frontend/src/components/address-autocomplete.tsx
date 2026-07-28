import { useState, useRef, useEffect, useCallback } from "react";
import { MapPin, Navigation, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AddressSuggestion {
  id: string;
  city: string;
  state: string;
  fullAddress: string;
  lat: number;
  lng: number;
  type: "city" | "recent" | "popular";
}

const INDIAN_CITIES: AddressSuggestion[] = [
  { id: "1", city: "Mumbai", state: "Maharashtra", fullAddress: "Mumbai, Maharashtra", lat: 19.0760, lng: 72.8777, type: "popular" },
  { id: "2", city: "Delhi", state: "Delhi", fullAddress: "Delhi, Delhi", lat: 28.7041, lng: 77.1025, type: "popular" },
  { id: "3", city: "Bangalore", state: "Karnataka", fullAddress: "Bangalore, Karnataka", lat: 12.9716, lng: 77.5946, type: "popular" },
  { id: "4", city: "Chennai", state: "Tamil Nadu", fullAddress: "Chennai, Tamil Nadu", lat: 13.0827, lng: 80.2707, type: "popular" },
  { id: "5", city: "Kolkata", state: "West Bengal", fullAddress: "Kolkata, West Bengal", lat: 22.5726, lng: 88.3639, type: "popular" },
  { id: "6", city: "Hyderabad", state: "Telangana", fullAddress: "Hyderabad, Telangana", lat: 17.3850, lng: 78.4867, type: "popular" },
  { id: "7", city: "Pune", state: "Maharashtra", fullAddress: "Pune, Maharashtra", lat: 18.5204, lng: 73.8567, type: "city" },
  { id: "8", city: "Ahmedabad", state: "Gujarat", fullAddress: "Ahmedabad, Gujarat", lat: 23.0225, lng: 72.5714, type: "popular" },
  { id: "9", city: "Jaipur", state: "Rajasthan", fullAddress: "Jaipur, Rajasthan", lat: 26.9124, lng: 75.7873, type: "city" },
  { id: "10", city: "Surat", state: "Gujarat", fullAddress: "Surat, Gujarat", lat: 21.1702, lng: 72.8311, type: "city" },
  { id: "11", city: "Lucknow", state: "Uttar Pradesh", fullAddress: "Lucknow, Uttar Pradesh", lat: 26.8467, lng: 80.9462, type: "city" },
  { id: "12", city: "Kanpur", state: "Uttar Pradesh", fullAddress: "Kanpur, Uttar Pradesh", lat: 26.4499, lng: 80.3319, type: "city" },
  { id: "13", city: "Nagpur", state: "Maharashtra", fullAddress: "Nagpur, Maharashtra", lat: 21.1458, lng: 79.0882, type: "city" },
  { id: "14", city: "Indore", state: "Madhya Pradesh", fullAddress: "Indore, Madhya Pradesh", lat: 22.7196, lng: 75.8577, type: "city" },
  { id: "15", city: "Bhopal", state: "Madhya Pradesh", fullAddress: "Bhopal, Madhya Pradesh", lat: 23.2599, lng: 77.4126, type: "city" },
  { id: "16", city: "Patna", state: "Bihar", fullAddress: "Patna, Bihar", lat: 25.5941, lng: 85.1376, type: "city" },
  { id: "17", city: "Vadodara", state: "Gujarat", fullAddress: "Vadodara, Gujarat", lat: 22.3072, lng: 73.1812, type: "city" },
  { id: "18", city: "Ghaziabad", state: "Uttar Pradesh", fullAddress: "Ghaziabad, Uttar Pradesh", lat: 28.6692, lng: 77.4538, type: "city" },
  { id: "19", city: "Ludhiana", state: "Punjab", fullAddress: "Ludhiana, Punjab", lat: 30.9010, lng: 75.8573, type: "city" },
  { id: "20", city: "Agra", state: "Uttar Pradesh", fullAddress: "Agra, Uttar Pradesh", lat: 27.1767, lng: 78.0081, type: "city" },
  { id: "21", city: "Nashik", state: "Maharashtra", fullAddress: "Nashik, Maharashtra", lat: 19.9975, lng: 73.7898, type: "city" },
  { id: "22", city: "Faridabad", state: "Haryana", fullAddress: "Faridabad, Haryana", lat: 28.4089, lng: 77.3178, type: "city" },
  { id: "23", city: "Meerut", state: "Uttar Pradesh", fullAddress: "Meerut, Uttar Pradesh", lat: 28.9845, lng: 77.7064, type: "city" },
  { id: "24", city: "Rajkot", state: "Gujarat", fullAddress: "Rajkot, Gujarat", lat: 22.3039, lng: 70.8022, type: "city" },
  { id: "25", city: "Varanasi", state: "Uttar Pradesh", fullAddress: "Varanasi, Uttar Pradesh", lat: 25.3176, lng: 82.9739, type: "city" },
  { id: "26", city: "Srinagar", state: "Jammu & Kashmir", fullAddress: "Srinagar, Jammu & Kashmir", lat: 34.0837, lng: 74.7973, type: "city" },
  { id: "27", city: "Aurangabad", state: "Maharashtra", fullAddress: "Aurangabad, Maharashtra", lat: 19.8762, lng: 75.3433, type: "city" },
  { id: "28", city: "Dhanbad", state: "Jharkhand", fullAddress: "Dhanbad, Jharkhand", lat: 23.7957, lng: 86.4304, type: "city" },
  { id: "29", city: "Amritsar", state: "Punjab", fullAddress: "Amritsar, Punjab", lat: 31.6340, lng: 74.8723, type: "city" },
  { id: "30", city: "Allahabad", state: "Uttar Pradesh", fullAddress: "Allahabad, Uttar Pradesh", lat: 25.4358, lng: 81.8463, type: "city" },
  { id: "31", city: "Ranchi", state: "Jharkhand", fullAddress: "Ranchi, Jharkhand", lat: 23.3441, lng: 85.3096, type: "city" },
  { id: "32", city: "Coimbatore", state: "Tamil Nadu", fullAddress: "Coimbatore, Tamil Nadu", lat: 11.0168, lng: 76.9558, type: "city" },
  { id: "33", city: "Jabalpur", state: "Madhya Pradesh", fullAddress: "Jabalpur, Madhya Pradesh", lat: 23.1815, lng: 79.9864, type: "city" },
  { id: "34", city: "Gwalior", state: "Madhya Pradesh", fullAddress: "Gwalior, Madhya Pradesh", lat: 26.2183, lng: 78.1828, type: "city" },
  { id: "35", city: "Vijayawada", state: "Andhra Pradesh", fullAddress: "Vijayawada, Andhra Pradesh", lat: 16.5062, lng: 80.6480, type: "city" },
  { id: "36", city: "Jodhpur", state: "Rajasthan", fullAddress: "Jodhpur, Rajasthan", lat: 26.2389, lng: 73.0243, type: "city" },
  { id: "37", city: "Madurai", state: "Tamil Nadu", fullAddress: "Madurai, Tamil Nadu", lat: 9.9252, lng: 78.1198, type: "city" },
  { id: "38", city: "Raipur", state: "Chhattisgarh", fullAddress: "Raipur, Chhattisgarh", lat: 21.2514, lng: 81.6296, type: "city" },
  { id: "39", city: "Chandigarh", state: "Chandigarh", fullAddress: "Chandigarh, Chandigarh", lat: 30.7333, lng: 76.7794, type: "city" },
  { id: "40", city: "Guwahati", state: "Assam", fullAddress: "Guwahati, Assam", lat: 26.1445, lng: 91.7362, type: "city" },
  { id: "41", city: "Visakhapatnam", state: "Andhra Pradesh", fullAddress: "Visakhapatnam, Andhra Pradesh", lat: 17.6868, lng: 83.2185, type: "city" },
  { id: "42", city: "Thiruvananthapuram", state: "Kerala", fullAddress: "Thiruvananthapuram, Kerala", lat: 8.5241, lng: 76.9366, type: "city" },
  { id: "43", city: "Kochi", state: "Kerala", fullAddress: "Kochi, Kerala", lat: 9.9312, lng: 76.2673, type: "city" },
  { id: "44", city: "Mangalore", state: "Karnataka", fullAddress: "Mangalore, Karnataka", lat: 12.9141, lng: 74.8560, type: "city" },
  { id: "45", city: "Noida", state: "Uttar Pradesh", fullAddress: "Noida, Uttar Pradesh", lat: 28.5355, lng: 77.3910, type: "city" },
  { id: "46", city: "Gurugram", state: "Haryana", fullAddress: "Gurugram, Haryana", lat: 28.4595, lng: 77.0266, type: "city" },
  { id: "47", city: "Thane", state: "Maharashtra", fullAddress: "Thane, Maharashtra", lat: 19.2183, lng: 72.9781, type: "city" },
  { id: "48", city: "Hubli", state: "Karnataka", fullAddress: "Hubli, Karnataka", lat: 15.3647, lng: 75.1240, type: "city" },
  { id: "49", city: "Mysore", state: "Karnataka", fullAddress: "Mysore, Karnataka", lat: 12.2958, lng: 76.6394, type: "city" },
  { id: "50", city: "Tiruchirappalli", state: "Tamil Nadu", fullAddress: "Tiruchirappalli, Tamil Nadu", lat: 10.7905, lng: 78.7047, type: "city" },
  { id: "51", city: "Nanded", state: "Maharashtra", fullAddress: "Nanded, Maharashtra", lat: 19.1667, lng: 77.3167, type: "city" },
];

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string, suggestion?: AddressSuggestion) => void;
  placeholder?: string;
  className?: string;
  testId?: string;
}

export function AddressAutocomplete({
  value,
  onChange,
  placeholder = "Enter city or address",
  className,
  testId,
}: AddressAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const searchCities = useCallback((query: string) => {
    if (!query.trim()) {
      const popular = INDIAN_CITIES.filter(c => c.type === "popular").slice(0, 5);
      setSuggestions(popular);
      return;
    }

    const q = query.toLowerCase();
    const matches = INDIAN_CITIES.filter(
      (city) =>
        city.city.toLowerCase().includes(q) ||
        city.state.toLowerCase().includes(q) ||
        city.fullAddress.toLowerCase().includes(q)
    ).slice(0, 8);

    setSuggestions(matches);
  }, []);

  useEffect(() => {
    searchCities(value);
  }, [value, searchCities]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (suggestion: AddressSuggestion) => {
    onChange(suggestion.fullAddress, suggestion);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
          handleSelect(suggestions[highlightedIndex]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  const getIcon = (type: AddressSuggestion["type"]) => {
    switch (type) {
      case "recent":
        return <Clock className="h-4 w-4 text-muted-foreground" />;
      case "popular":
        return <Navigation className="h-4 w-4 text-primary" />;
      default:
        return <MapPin className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`pl-9 ${className || ""}`}
          data-testid={testId}
          autoComplete="off"
        />
      </div>

      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md">
          <ScrollArea className="max-h-[240px]">
            <div className="p-1">
              {!value.trim() && (
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  Popular destinations
                </div>
              )}
              {suggestions.map((suggestion, index) => (
                <button
                  key={suggestion.id}
                  type="button"
                  className={`w-full flex items-center gap-3 px-2 py-2 rounded-md text-left ${
                    index === highlightedIndex
                      ? "bg-accent text-accent-foreground"
                      : "hover-elevate"
                  }`}
                  onClick={() => handleSelect(suggestion)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  data-testid={`address-suggestion-${suggestion.id}`}
                >
                  {getIcon(suggestion.type)}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {suggestion.city}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {suggestion.state}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
          <div className="border-t px-3 py-2 text-xs text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            <span>Simulated address suggestions</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export function estimateDrivingTime(distanceKm: number): string {
  const hours = distanceKm / 50; // Average speed ~50 km/h for Indian roads
  if (hours < 1) {
    return `${Math.round(hours * 60)} mins`;
  } else if (hours < 24) {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  } else {
    const days = Math.floor(hours / 10);
    return `${days} day${days > 1 ? "s" : ""}`;
  }
}

export function getRouteInfo(
  originCity: string,
  destCity: string
): { distance: number; duration: string } | null {
  const normalizeCity = (s: string) =>
    s
      .trim()
      // normalize comma spacing: "Nanded,Maharashtra" -> "Nanded, Maharashtra"
      .replace(/\s*,\s*/g, ", ");
  const o = normalizeCity(originCity);
  const d = normalizeCity(destCity);
  const origin = INDIAN_CITIES.find(
    (c) =>
      c.fullAddress.toLowerCase() === o.toLowerCase() ||
      c.city.toLowerCase() === o.toLowerCase()
  );
  const dest = INDIAN_CITIES.find(
    (c) =>
      c.fullAddress.toLowerCase() === d.toLowerCase() ||
      c.city.toLowerCase() === d.toLowerCase()
  );

  if (!origin || !dest) return null;

  const distance = calculateDistance(origin.lat, origin.lng, dest.lat, dest.lng);
  const roadDistance = Math.round(distance * 1.3);
  const duration = estimateDrivingTime(roadDistance);

  return { distance: roadDistance, duration };
}

export { INDIAN_CITIES };
export type { AddressSuggestion };
