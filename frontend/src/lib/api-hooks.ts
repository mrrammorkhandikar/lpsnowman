import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, queryClient } from "./queryClient";
import {
  intutrackLogin,
  intutrackConsent,
  intutrackStartTrip,
  intutrackEndTrip,
  type IntutrackStartTripPayload,
} from "./intutrack-api";

export type { IntutrackStartTripPayload } from "./intutrack-api";
import type { Load, Bid, Truck, User, Shipment, Invoice, Notification, Document, CarrierProfile, NegotiationThread, Driver } from "../shared/schema";

type LoadWithBids = Load & { bids?: Bid[]; bidCount?: number };
type BidWithDetails = Bid & { carrier?: Partial<User>; load?: Load };
type CarrierWithProfile = Omit<User, 'password'> & { carrierProfile?: CarrierProfile };

// Grouped bids response from /api/loads/:id/bids endpoint
export type GroupedBidsResponse = {
  soloBids: BidWithDetails[];
  enterpriseBids: BidWithDetails[];
  allBids: BidWithDetails[];
  summary: {
    totalBids: number;
    soloBidCount: number;
    enterpriseBidCount: number;
    lowestSoloBid: number | null;
    lowestEnterpriseBid: number | null;
  };
};

export function useLoads() {
  return useQuery<LoadWithBids[]>({
    queryKey: ['/api/loads'],
    staleTime: 30000,
    refetchInterval: 30000,
  });
}

export function useLoad(id: string | undefined) {
  return useQuery<LoadWithBids>({
    queryKey: ['/api/loads', id],
    enabled: !!id,
    staleTime: 15000,
  });
}

export function useLoadHistory(loadId: string | undefined) {
  return useQuery({
    queryKey: ['/api/loads', loadId, 'history'],
    enabled: !!loadId,
  });
}

export function useCreateLoad() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Load>) => {
      const res = await apiRequest('POST', '/api/loads', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/loads'] });
    },
  });
}

export function useUpdateLoad() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Load> }) => {
      const res = await apiRequest('PATCH', `/api/loads/${id}`, updates);
      return res.json();
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/loads'] });
      queryClient.invalidateQueries({ queryKey: ['/api/loads', id] });
    },
  });
}

export function useTransitionLoadState() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ loadId, toStatus, reason }: { loadId: string; toStatus: string; reason?: string }) => {
      const res = await apiRequest('POST', `/api/loads/${loadId}/transition`, { toStatus, reason });
      return res.json();
    },
    onSuccess: (_, { loadId }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/loads'] });
      queryClient.invalidateQueries({ queryKey: ['/api/loads', loadId] });
    },
  });
}

export function useBids() {
  return useQuery<BidWithDetails[]>({
    queryKey: ['/api/bids'],
    staleTime: 15000,
    refetchInterval: 15000,
  });
}

export function useBidsByLoad(loadId: string | undefined) {
  return useQuery<GroupedBidsResponse>({
    queryKey: ['/api/loads', loadId, 'bids'],
    enabled: !!loadId,
    staleTime: 10000,
  });
}

// Legacy hook that returns flat array for backwards compatibility
export function useBidsByLoadFlat(loadId: string | undefined) {
  const { data, ...rest } = useBidsByLoad(loadId);
  return {
    ...rest,
    data: data?.allBids || [],
  };
}

export function useCreateBid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Bid>) => {
      const res = await apiRequest('POST', '/api/bids', data);
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/bids'] });
      queryClient.invalidateQueries({ queryKey: ['/api/loads', variables.loadId, 'bids'] });
      queryClient.invalidateQueries({ queryKey: ['/api/loads'] });
    },
  });
}

export function useUpdateBid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Bid> & { action?: string } }) => {
      const res = await apiRequest('PATCH', `/api/bids/${id}`, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bids'] });
      queryClient.invalidateQueries({ queryKey: ['/api/loads'] });
    },
  });
}

export function useTrucks() {
  return useQuery<Truck[]>({
    queryKey: ['/api/trucks'],
    staleTime: 60000,
  });
}

export function useCreateTruck() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Truck>) => {
      const res = await apiRequest('POST', '/api/trucks', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trucks'] });
    },
  });
}

export function useUpdateTruck() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Truck> }) => {
      const res = await apiRequest('PATCH', `/api/trucks/${id}`, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trucks'] });
    },
  });
}

export function useDeleteTruck() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/trucks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trucks'] });
    },
  });
}

export function useShipments() {
  return useQuery<Shipment[]>({
    queryKey: ['/api/shipments'],
    staleTime: 30000,
  });
}

// Use enriched shipments with load data for trips page
export function useShipmentsTracking() {
  return useQuery<any[]>({
    queryKey: ['/api/shipments/tracking'],
    staleTime: 15000,
    refetchInterval: 30000,
  });
}

export function useShipment(id: string | undefined) {
  return useQuery<Shipment>({
    queryKey: ['/api/shipments', id],
    enabled: !!id,
  });
}

export function useShipmentByLoad(loadId: string | undefined) {
  return useQuery<Shipment>({
    queryKey: ['/api/shipments/load', loadId],
    enabled: !!loadId,
  });
}

export function useInvoices() {
  return useQuery<Invoice[]>({
    queryKey: ['/api/invoices'],
    staleTime: 30000,
  });
}

export function useInvoice(id: string | undefined) {
  return useQuery<Invoice>({
    queryKey: ['/api/invoices', id],
    enabled: !!id,
  });
}

export function useInvoicesByShipper() {
  return useQuery<Invoice[]>({
    queryKey: ['/api/invoices/shipper'],
    staleTime: 30000,
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Invoice>) => {
      const res = await apiRequest('POST', '/api/invoices', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
    },
  });
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Invoice> }) => {
      const res = await apiRequest('PATCH', `/api/invoices/${id}`, updates);
      return res.json();
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      queryClient.invalidateQueries({ queryKey: ['/api/invoices', id] });
    },
  });
}

export function useSendInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('POST', `/api/invoices/${id}/send`);
      return res.json();
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      queryClient.invalidateQueries({ queryKey: ['/api/invoices', id] });
      queryClient.invalidateQueries({ queryKey: ['/api/loads'] });
    },
  });
}

export function useNotifications() {
  return useQuery<Notification[]>({
    queryKey: ['/api/notifications'],
    staleTime: 10000,
    refetchInterval: 30000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('PATCH', `/api/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await apiRequest('POST', '/api/notifications/read-all');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    },
  });
}

export function useDocuments() {
  return useQuery<Document[]>({
    queryKey: ['/api/documents'],
    staleTime: 60000,
  });
}

export function useDocumentsByLoad(loadId: string | undefined) {
  return useQuery<Document[]>({
    queryKey: ['/api/loads', loadId, 'documents'],
    enabled: !!loadId,
  });
}

export function useCarriers() {
  return useQuery<CarrierWithProfile[]>({
    queryKey: ['/api/carriers'],
    staleTime: 60000,
  });
}

export function useCarrier(id: string | undefined) {
  return useQuery<CarrierWithProfile>({
    queryKey: ['/api/carriers', id],
    enabled: !!id,
  });
}

export function useUsers() {
  return useQuery<Omit<User, 'password'>[]>({
    queryKey: ['/api/users'],
    staleTime: 60000,
  });
}

export function useAdminStats() {
  return useQuery({
    queryKey: ['/api/admin/stats'],
    staleTime: 30000,
    refetchInterval: 60000,
  });
}

export function useAdminLoadQueue() {
  return useQuery<Load[]>({
    queryKey: ['/api/admin/load-queue'],
    staleTime: 15000,
    refetchInterval: 30000,
  });
}

export function useNegotiationThreads() {
  return useQuery<NegotiationThread[]>({
    queryKey: ['/api/negotiations'],
    staleTime: 15000,
    refetchInterval: 30000,
  });
}

export function useNegotiationThread(loadId: string | undefined) {
  return useQuery<NegotiationThread>({
    queryKey: ['/api/negotiations', loadId],
    enabled: !!loadId,
    staleTime: 10000,
  });
}

export function useAdminPricing(loadId: string | undefined) {
  return useQuery({
    queryKey: ['/api/admin/pricing', loadId],
    enabled: !!loadId,
  });
}

export function useCreateAdminPricing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { loadId: string; suggestedPrice: string; postMode?: string; invitedCarrierIds?: string[] }) => {
      const res = await apiRequest('POST', '/api/admin/pricing', data);
      return res.json();
    },
    onSuccess: (_, { loadId }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/pricing', loadId] });
      queryClient.invalidateQueries({ queryKey: ['/api/loads', loadId] });
      queryClient.invalidateQueries({ queryKey: ['/api/loads'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/load-queue'] });
    },
  });
}

export function useLockAdminPricing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ pricingId, finalPrice, postMode, invitedCarrierIds }: { pricingId: string; finalPrice: string; postMode: string; invitedCarrierIds?: string[] }) => {
      const res = await apiRequest('POST', `/api/admin/pricing/${pricingId}/lock`, { finalPrice, postMode, invitedCarrierIds });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/pricing'] });
      queryClient.invalidateQueries({ queryKey: ['/api/loads'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/load-queue'] });
    },
  });
}

export function useCarrierVerifications() {
  return useQuery({
    queryKey: ['/api/carrier-verifications'],
    staleTime: 30000,
  });
}

export function useCarrierVerification(carrierId: string | undefined) {
  return useQuery({
    queryKey: ['/api/carrier-verifications', carrierId],
    enabled: !!carrierId,
  });
}

export function useUpdateCarrierVerification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      const res = await apiRequest('PATCH', `/api/carrier-verifications/${id}`, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/carrier-verifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/carriers'] });
    },
  });
}

export function useTelemetry(vehicleId?: string) {
  return useQuery({
    queryKey: vehicleId ? ['/api/telemetry/vehicles', vehicleId] : ['/api/telemetry/vehicles'],
    staleTime: 5000,
    refetchInterval: 10000,
  });
}

export function useEtaPrediction(vehicleId: string | undefined) {
  return useQuery({
    queryKey: ['/api/telemetry/vehicles', vehicleId, 'eta'],
    enabled: !!vehicleId,
    staleTime: 30000,
  });
}

export function useSettlements() {
  return useQuery({
    queryKey: ['/api/settlements'],
    staleTime: 60000,
  });
}

export function useDrivers() {
  return useQuery<Driver[]>({
    queryKey: ['/api/drivers'],
    staleTime: 30000,
  });
}

export function useSettlementsByCarrier() {
  return useQuery({
    queryKey: ['/api/settlements/carrier'],
    staleTime: 60000,
  });
}

export function invalidateAllData() {
  queryClient.invalidateQueries();
}

export function invalidateLoads() {
  queryClient.invalidateQueries({ queryKey: ['/api/loads'] });
}

export function invalidateBids() {
  queryClient.invalidateQueries({ queryKey: ['/api/bids'] });
}

export function invalidateInvoices() {
  queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
}

// OTP Hooks
export interface OtpRequest {
  id: string;
  requestType: 'trip_start' | 'trip_end' | 'registration';
  carrierId: string;
  shipmentId: string;
  loadId: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  requestedAt?: string;
  processedAt?: string;
  processedBy?: string;
  otpId?: string;
  notes?: string;
  carrier?: { 
    id?: string;
    username: string; 
    companyName?: string;
    email?: string;
    phone?: string;
  };
  load?: { 
    id?: string;
    pickupCity?: string; 
    deliveryCity?: string; 
    dropoffCity?: string;
    adminReferenceNumber?: number;
    shipperLoadNumber?: number;
  };
  shipmentStatus?: string;
  approvedBy?: {
    id: string;
    username: string;
  };
}

export function useOtpRequests(status?: string) {
  return useQuery<OtpRequest[]>({
    queryKey: ['/api/otp/requests', status],
    staleTime: 5000,
    refetchInterval: 10000,
  });
}

// Shipper OTP request with enhanced carrier details (no phone/email)
export interface ShipperOtpRequest {
  id: string;
  requestType: 'trip_start' | 'trip_end' | 'registration';
  carrierId: string;
  shipmentId: string;
  loadId: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  requestedAt?: string;
  processedAt?: string;
  processedBy?: string;
  otpId?: string;
  notes?: string;
  carrier?: { 
    id?: string;
    username: string; 
    companyName?: string;
    driverName?: string;
    isSoloDriver?: boolean;
    rating?: string;
    totalDeliveries?: number;
    badgeLevel?: string;
    truckNumber?: string | null;
    truckType?: string | null;
  };
  load?: { 
    id?: string;
    pickupCity?: string; 
    deliveryCity?: string; 
    dropoffCity?: string;
    adminReferenceNumber?: number;
    shipperLoadNumber?: number;
  };
  shipmentStatus?: string;
  approvedBy?: {
    id: string;
    username: string;
  };
}

export function useShipperOtpRequests() {
  return useQuery<ShipperOtpRequest[]>({
    queryKey: ['/api/otp/shipper-requests'],
    staleTime: 5000,
    refetchInterval: 10000,
  });
}

export function invalidateShipperOtpRequests() {
  queryClient.invalidateQueries({ queryKey: ['/api/otp/shipper-requests'] });
}

export function useApproveOtpRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ requestId, validityMinutes = 10 }: { requestId: string; validityMinutes?: number }) => {
      const res = await apiRequest('POST', `/api/otp/approve/${requestId}`, { validityMinutes });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/otp/requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/otp/shipper-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/shipments'] });
    },
  });
}

export function useRejectOtpRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ requestId, notes }: { requestId: string; notes?: string }) => {
      const res = await apiRequest('POST', `/api/otp/reject/${requestId}`, { notes });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/otp/requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/otp/shipper-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/shipments'] });
    },
  });
}

export function useRegenerateOtpRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ requestId, validityMinutes = 10 }: { requestId: string; validityMinutes?: number }) => {
      const res = await apiRequest('POST', `/api/otp/regenerate/${requestId}`, { validityMinutes });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/otp/requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/otp/shipper-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/shipments'] });
    },
  });
}

export function useRequestTripStartOtp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (shipmentId: string) => {
      const res = await apiRequest('POST', '/api/otp/request-start', { shipmentId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/otp/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/shipments'] });
    },
  });
}

export function useRequestTripEndOtp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (shipmentId: string) => {
      const res = await apiRequest('POST', '/api/otp/request-end', { shipmentId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/otp/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/shipments'] });
    },
  });
}

export function useRequestRouteStartOtp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (shipmentId: string) => {
      const res = await apiRequest('POST', '/api/otp/request-route-start', { shipmentId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/otp/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/shipments'] });
    },
  });
}

export function useVerifyOtp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ shipmentId, otpCode, otpType }: { shipmentId: string; otpCode: string; otpType: 'trip_start' | 'route_start' | 'trip_end' }) => {
      const res = await apiRequest('POST', '/api/otp/verify', { shipmentId, otpCode, otpType });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/otp/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/shipments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/loads'] });
    },
  });
}

export function useOtpStatus(shipmentId: string | undefined) {
  return useQuery({
    queryKey: ['/api/otp/status', shipmentId],
    enabled: !!shipmentId,
    staleTime: 5000,
    refetchInterval: 10000,
  });
}

export function invalidateOtpRequests() {
  queryClient.invalidateQueries({ queryKey: ['/api/otp/requests'] });
}

// --- IntuTrack API hooks (proxy to https://sct.intutrack.com/api/prod) ---

export function useIntutrackLogin() {
  return useMutation({
    mutationFn: () => intutrackLogin(),
  });
}

export function useIntutrackConsent(tel: string | undefined) {
  return useQuery({
    queryKey: ['/api/intutrack/consent', tel],
    queryFn: () => intutrackConsent(tel!),
    enabled: !!tel && tel.length > 0,
    staleTime: 60000,
  });
}

export function useIntutrackStartTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: IntutrackStartTripPayload) => intutrackStartTrip(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/intutrack'] });
      queryClient.invalidateQueries({ queryKey: ['/api/shipments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/shipments/tracking'] });
    },
  });
}

export function useIntutrackEndTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { tripId?: string; loadId?: string }) => intutrackEndTrip(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/intutrack'] });
      queryClient.invalidateQueries({ queryKey: ['/api/shipments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/shipments/tracking'] });
    },
  });
}

export type {
  IntutrackStartTripPayload,
  IntutrackLoginResponse,
  IntutrackConsentResponse,
  IntutrackStartTripResponse,
  IntutrackEndTripResponse,
} from "./intutrack-api";

export { queryClient };
