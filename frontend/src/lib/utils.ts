import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Derives a region/state name from a location string.
 * Handles formats like "Mumbai, Maharashtra" -> "Maharashtra"
 * or "Chennai, TN" -> "TN"
 * @param location - The location string (e.g., dropoffCity, pickupCity)
 * @returns The region/state name or "Unknown" if not extractable
 */
export function deriveRegion(location: string | undefined | null): string {
  if (!location || location.trim() === '') {
    return 'Unknown';
  }
  
  // Try to extract state from "City, State" format
  const parts = location.split(',');
  if (parts.length >= 2) {
    const region = parts[parts.length - 1].trim();
    if (region && region !== '') {
      return region;
    }
  }
  
  // Fallback to using the location directly (it might be just a state name)
  return location.trim();
}

/**
 * Builds region metrics from shipments and loads data.
 * Can be used for both active trips and revenue analytics.
 * Includes BOTH pickup and dropoff regions for each trip.
 * @param shipments - Array of shipments
 * @param loads - Array of loads with pickup and dropoff cities
 * @param statusFilter - Optional array of statuses to filter by
 * @returns Object with region metrics and list of regions
 */
export function buildRegionMetrics(
  shipments: Array<{ loadId: string; status: string }>,
  loads: Array<{ id: string; dropoffCity?: string; pickupCity?: string; adminFinalPrice?: string | number | null; finalPrice?: string | number | null }>,
  statusFilter?: string[]
): { 
  regionList: string[]; 
  revenueByRegion: Array<{ region: string; revenue: number; trips: number; growth: number }>;
} {
  const regionRevenueMap: Record<string, { revenue: number; trips: number }> = {};
  
  const filteredShipments = statusFilter 
    ? shipments.filter(s => statusFilter.includes(s.status))
    : shipments;
  
  filteredShipments.forEach(shipment => {
    const load = loads.find(l => l.id === shipment.loadId);
    if (load) {
      const pickupRegion = deriveRegion((load as any).pickupCity);
      const dropoffRegion = deriveRegion((load as any).dropoffCity);
      // Use finalPrice first, fallback to adminFinalPrice (no 0.85 multiplier - full carrier payout)
      const tripRevenue = load.finalPrice 
        ? parseFloat(load.finalPrice.toString())
        : load.adminFinalPrice 
        ? parseFloat(load.adminFinalPrice.toString())
        : 0;
      
      // Count trip for both pickup and dropoff regions (if different)
      const regions = new Set([pickupRegion, dropoffRegion]);
      regions.forEach(region => {
        if (region && region !== 'Unknown') {
          if (!regionRevenueMap[region]) {
            regionRevenueMap[region] = { revenue: 0, trips: 0 };
          }
          regionRevenueMap[region].trips += 1;
          // Only add revenue to destination region (where delivery happens)
          if (region === dropoffRegion) {
            regionRevenueMap[region].revenue += tripRevenue;
          }
        }
      });
    }
  });
  
  const revenueByRegion = Object.entries(regionRevenueMap)
    .map(([region, data]) => ({
      region,
      revenue: data.revenue,
      trips: data.trips,
      growth: 0
    }))
    .sort((a, b) => b.revenue - a.revenue);
  
  const regionList = revenueByRegion.map(r => r.region);
  
  return { regionList, revenueByRegion };
}
