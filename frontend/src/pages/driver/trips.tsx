import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { getDocumentUrl } from "@/lib/document-utils";
import { 
  MapPin, Truck, Clock, CheckCircle, Upload,
  Route, Calendar, TrendingUp, ArrowRight, Map as MapIcon, Lock,
  Package, Building2,
  FileText, Eye, Download, Check, Loader2, Camera, SwitchCamera, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/empty-state";
import { StatCard } from "@/components/stat-card";
import { useToast } from "@/hooks/use-toast";
import { type CarrierTrip } from "@/lib/carrier-data-store";
import { format, addHours } from "date-fns";
import { useAuth } from "@/lib/auth-context";
import { useShipments, useLoads, useShipmentsTracking } from "@/lib/api-hooks";
import { onMarketplaceEvent } from "@/lib/marketplace-socket";
import type { Shipment, Load, Driver, Truck as DbTruck } from "@shared/schema";
import { OtpTripActions } from "@/components/otp-trip-actions";
import { ShipmentMap } from "@/components/shipment-map";
import { buildFullAddress } from "@/lib/address-utils";
import { computeRouteDistanceKmEstimate } from "@/lib/route-distance";
import { uploadFileWithPresignedFallback } from "@/hooks/use-upload";

const documentTypeToLabel: Record<string, string> = {
  lr_consignment: "LR / Consignment Note",
  eway_bill: "E-way Bill",
  loading_photos: "Loading Photos",
  pod: "Proof of Delivery (POD)",
  invoice: "Invoice",
  receipts: "Receipts",
  other: "Other Document",
};

const labelToDocumentType: Record<string, string> = {
  "LR / Consignment Note": "lr_consignment",
  "E-way Bill": "eway_bill",
  "Loading Photos": "loading_photos",
  "Proof of Delivery (POD)": "pod",
  "Invoice": "invoice",
  "Receipts": "receipts",
  "Other Document": "other",
};

interface ShipmentDocument {
  id: string;
  shipmentId: string;
  documentType: string;
  fileUrl: string | null;
  notes: string | null;
  uploadedBy: string;
  status: string | null;
  createdAt: Date | null;
}

interface RealShipment {
  id: string;
  loadId: string;
  status: string;
  startOtpRequested: boolean;
  startOtpVerified: boolean;
  endOtpRequested: boolean;
  endOtpVerified: boolean;
  load?: {
    adminReferenceNumber?: number;
    pickupCity?: string;
    dropoffCity?: string;
  };
}

function formatCurrency(amount: number | undefined | null): string {
  const value = amount ?? 0;
  return `Rs. ${value.toLocaleString("en-IN")}`;
}

const statusConfig: Record<CarrierTrip["status"], { label: string; color: string }> = {
  awaiting_pickup: { label: "Awaiting Pickup", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  picked_up: { label: "Picked Up", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  in_transit: { label: "In Transit", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  at_checkpoint: { label: "At Checkpoint", color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400" },
  out_for_delivery: { label: "Out for Delivery", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  delivered: { label: "Delivered", color: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400" },
};

function convertShipmentToTrip(
  shipment: Shipment, 
  load: Load | undefined, 
  drivers: Driver[], 
  trucks: DbTruck[]
): CarrierTrip {
  const loadId = load?.shipperLoadNumber 
    ? `LD-${String(load.shipperLoadNumber).padStart(3, '0')}` 
    : load?.adminReferenceNumber
      ? `LD-${String(load.adminReferenceNumber).padStart(3, '0')}`
      : `LD-${shipment.loadId.slice(0, 6)}`;
  
  let status: CarrierTrip["status"] = "awaiting_pickup";
  let progress = 0;
  
  if (shipment.endOtpVerified) {
    status = "delivered";
    progress = 100;
  } else if (shipment.status === "in_transit") {
    status = "in_transit";
    progress = 50;
  } else if (shipment.startOtpVerified) {
    status = "in_transit";
    progress = 30;
  } else if (shipment.startOtpRequested) {
    status = "awaiting_pickup";
    progress = 10;
  }

  let totalDistance = 0;
  if (load) {
    const k = computeRouteDistanceKmEstimate({
      pickupLat: load.pickupLat,
      pickupLng: load.pickupLng,
      dropoffLat: load.dropoffLat,
      dropoffLng: load.dropoffLng,
      pickupCity: load.pickupCity,
      dropoffCity: load.dropoffCity,
    });
    if (Number.isFinite(k)) {
      const r = Math.round(k);
      if (r >= 1) totalDistance = r;
    }
  }
  const rate = parseFloat(load?.finalPrice || (load as any)?.adminFinalPrice || "0");
  const now = new Date();
  const createdAt = shipment.createdAt instanceof Date ? shipment.createdAt : new Date(shipment.createdAt || now);

  const assignedDriver = shipment.driverId ? drivers.find(d => d.id === shipment.driverId) : null;
  const assignedTruck = shipment.truckId 
    ? trucks.find(t => t.id === shipment.truckId) 
    : (load as any)?.assignedTruckId 
      ? trucks.find(t => t.id === (load as any).assignedTruckId)
      : trucks[0];

  const driverName = assignedDriver?.name || "Unassigned";
  const driverLicense = assignedDriver?.licenseNumber || "—";
  const truckName = assignedTruck 
    ? `${assignedTruck.make || ""} ${assignedTruck.model || ""} (${assignedTruck.licensePlate || ""})`.trim()
    : "Unassigned";

  return {
    tripId: `real-${shipment.id}`,
    loadId,
    pickup: load?.pickupCity || "Unknown",
    dropoff: load?.dropoffCity || "Unknown",
    pickupAddress: load?.pickupAddress || null,
    pickupLocality: (load as any)?.pickupLocality || null,
    pickupLandmark: (load as any)?.pickupLandmark || null,
    dropoffAddress: load?.dropoffAddress || null,
    dropoffLocality: (load as any)?.dropoffLocality || null,
    dropoffLandmark: (load as any)?.dropoffLandmark || null,
    dropoffBusinessName: (load as any)?.dropoffBusinessName || null,
    status,
    progress,
    totalDistance,
    completedDistance: Math.round(totalDistance * (progress / 100)),
    eta: addHours(now, 12),
    originalEta: addHours(now, 12),
    rate,
    profitabilityEstimate: Math.round(rate * 0.25),
    currentLocation: load?.pickupCity || "En route",
    driverAssigned: driverName,
    driverAssignedId: shipment.driverId || "unassigned",
    truckAssigned: truckName,
    truckAssignedId: assignedTruck?.id || "unassigned",
    loadType: (load as any)?.cargoType || "General",
    weight: typeof load?.weight === 'number' ? load.weight : 10,
    startDate: createdAt,
    fuel: { fuelConsumed: 0, costPerLiter: 95, totalFuelCost: 0, fuelEfficiency: 4, costOverrun: 0, refuelAlerts: [] },
    driverInsights: { driverName, driverLicense, drivingHoursToday: 0, breaksTaken: 0, speedingAlerts: 0, harshBrakingEvents: 0, safetyScore: 85, idleTime: 0 },
    allStops: [
      { stopId: "s1", location: [load?.pickupAddress, (load as any)?.pickupLocality, (load as any)?.pickupLandmark, load?.pickupCity, (load as any)?.pickupState].filter(Boolean).join(', ') || "Origin", type: "pickup", status: shipment.startOtpVerified ? "completed" : "pending", scheduledTime: createdAt, actualTime: shipment.startOtpVerified ? createdAt : null },
      { stopId: "s2", location: [load?.dropoffAddress, (load as any)?.dropoffLocality, (load as any)?.dropoffLandmark, load?.dropoffCity, (load as any)?.dropoffState].filter(Boolean).join(', ') || "Destination", type: "delivery", status: shipment.endOtpVerified ? "completed" : "pending", scheduledTime: addHours(createdAt, 12), actualTime: shipment.endOtpVerified ? now : null },
    ],
    timeline: [
      { eventId: "e1", type: "pickup", description: "Shipment assigned", timestamp: createdAt, location: load?.pickupCity || "Origin" },
    ],
    shipperName: (load as any)?.shipperName || "Shipper",
  };
}

export default function TripsPage() {
  const { toast } = useToast();
  const { user, carrierType } = useAuth();
  const { data: shipments = [], refetch: refetchShipments } = useShipments();
  const { data: loads = [] } = useLoads();
  // Use enriched tracking data which includes load details for each shipment
  const { data: trackingShipments = [], refetch: refetchTracking } = useShipmentsTracking();
  const [selectedTrip, setSelectedTrip] = useState<CarrierTrip | null>(null);
  const [detailTab, setDetailTab] = useState("overview");
  const [documentViewerOpen, setDocumentViewerOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<{ type: string; image: string } | null>(null);
  const [multipleReceiptsViewerOpen, setMultipleReceiptsViewerOpen] = useState(false);
  const [selectedReceiptDocuments, setSelectedReceiptDocuments] = useState<ShipmentDocument[]>([]);
  const [currentReceiptIndex, setCurrentReceiptIndex] = useState(0);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState<string>("lr_consignment");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [tripSortOrder, setTripSortOrder] = useState<"newest" | "oldest" | "status">("newest");
  
  // Camera capture states
  const [cameraMode, setCameraMode] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Driver doesn't need to fetch other drivers or trucks
  // They only see their own assigned trips
  const drivers: Driver[] = [];
  const trucks: DbTruck[] = [];

  // Dummy data for when API doesn't return data
  const dummyShipments: any[] = [
    {
      id: "dummy-1",
      driverId: user?.id,
      loadId: "load-001",
      status: "in_transit",
      startOtpRequested: true,
      startOtpVerified: true,
      routeStartOtpRequested: true,
      routeStartOtpVerified: false,
      endOtpRequested: false,
      endOtpVerified: false,
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      load: {
        id: "load-001",
        shipperLoadNumber: 1,
        adminReferenceNumber: 1,
        pickupCity: "Mumbai",
        dropoffCity: "Pune",
        pickupAddress: "123 Industrial Area",
        pickupLocality: "Andheri",
        pickupLandmark: "Near Metro Station",
        dropoffAddress: "456 Business Park",
        dropoffLocality: "Hinjewadi",
        dropoffLandmark: "Tech Park",
        dropoffBusinessName: "Tech Solutions Ltd",
        pickupLat: 19.1136,
        pickupLng: 72.8697,
        dropoffLat: 18.5912,
        dropoffLng: 73.7499,
        weight: 15,
        cargoType: "Electronics",
        finalPrice: "5000",
        shipperName: "ABC Logistics",
        pickupState: "Maharashtra",
        dropoffState: "Maharashtra",
      },
    },
    {
      id: "dummy-2",
      driverId: user?.id,
      loadId: "load-002",
      status: "pickup_scheduled",
      startOtpRequested: false,
      startOtpVerified: false,
      routeStartOtpRequested: false,
      routeStartOtpVerified: false,
      endOtpRequested: false,
      endOtpVerified: false,
      createdAt: new Date(Date.now() - 30 * 60 * 1000),
      load: {
        id: "load-002",
        shipperLoadNumber: 2,
        adminReferenceNumber: 2,
        pickupCity: "Bangalore",
        dropoffCity: "Hyderabad",
        pickupAddress: "789 Warehouse Complex",
        pickupLocality: "Whitefield",
        pickupLandmark: "Near Airport",
        dropoffAddress: "321 Distribution Center",
        dropoffLocality: "Gachibowli",
        dropoffLandmark: "IT Hub",
        dropoffBusinessName: "Global Traders",
        pickupLat: 12.9716,
        pickupLng: 77.5946,
        dropoffLat: 17.3850,
        dropoffLng: 78.4867,
        weight: 20,
        cargoType: "Textiles",
        finalPrice: "7500",
        shipperName: "XYZ Exports",
        pickupState: "Karnataka",
        dropoffState: "Telangana",
      },
    },
    {
      id: "dummy-3",
      driverId: user?.id,
      loadId: "load-003",
      status: "in_transit",
      startOtpRequested: true,
      startOtpVerified: true,
      routeStartOtpRequested: true,
      routeStartOtpVerified: true,
      endOtpRequested: false,
      endOtpVerified: false,
      createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
      load: {
        id: "load-003",
        shipperLoadNumber: 3,
        adminReferenceNumber: 3,
        pickupCity: "Delhi",
        dropoffCity: "Jaipur",
        pickupAddress: "555 Industrial Estate",
        pickupLocality: "Okhla",
        pickupLandmark: "Near Highway",
        dropoffAddress: "888 Retail Park",
        dropoffLocality: "C-Scheme",
        dropoffLandmark: "City Center",
        dropoffBusinessName: "Retail Hub India",
        pickupLat: 28.5244,
        pickupLng: 77.1855,
        dropoffLat: 26.9124,
        dropoffLng: 75.7873,
        weight: 12,
        cargoType: "Furniture",
        finalPrice: "4500",
        shipperName: "Home Furnish Co",
        pickupState: "Delhi",
        dropoffState: "Rajasthan",
      },
    },
  ];

  const activeTrips = useMemo(() => {
    // Use tracking shipments which include enriched load data
    // Filter for shipments assigned to this driver
    const driverShipments = trackingShipments.filter(
      (s: any) =>
        (user?.driverId ? s.driverId === user.driverId : s.driverId === user?.id) &&
        s.status !== "delivered" &&
        s.status !== "cancelled"
    );
    
    // Sort based on selected sort order
    const sortedShipments = [...driverShipments].sort((a: any, b: any) => {
      if (tripSortOrder === "newest") {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA;
      } else if (tripSortOrder === "oldest") {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateA - dateB;
      } else {
        // Sort by status: in_transit first, then pickup_scheduled
        const statusOrder: Record<string, number> = { in_transit: 0, pickup_scheduled: 1 };
        return (statusOrder[a.status] ?? 2) - (statusOrder[b.status] ?? 2);
      }
    });
    
    return sortedShipments.map((shipment: any) => {
      // Extract load from enriched tracking shipment, or fall back to loads array
      const enrichedLoad = shipment.load;
      const fallbackLoad = loads.find(l => l.id === shipment.loadId);
      const load = enrichedLoad || fallbackLoad;
      return convertShipmentToTrip(shipment, load, drivers, trucks);
    });
  }, [trackingShipments, loads, user?.id, drivers, trucks, tripSortOrder]);

  useEffect(() => {
    if (!selectedTrip && activeTrips.length > 0) {
      setSelectedTrip(activeTrips[0]);
    }
  }, [activeTrips, selectedTrip]);

  useEffect(() => {
    const unsubApproved = onMarketplaceEvent("otp_approved", () => {
      refetchShipments();
      refetchTracking();
      toast({ title: "OTP Approved", description: "Trip OTP has been verified" });
    });
    const unsubCompleted = onMarketplaceEvent("trip_completed", () => {
      refetchShipments();
      refetchTracking();
      toast({ title: "Trip Completed", description: "Trip marked as delivered" });
    });
    const unsubRequested = onMarketplaceEvent("otp_requested", () => {
      refetchShipments();
      refetchTracking();
    });
    return () => { unsubApproved(); unsubCompleted(); unsubRequested(); };
  }, [refetchShipments, refetchTracking, toast]);

  const matchedShipment = useMemo(() => {
    if (!selectedTrip) return null;
    const tripShipmentId = selectedTrip.tripId.replace(/^real-/, '');
    const loadNum = selectedTrip.loadId.replace(/^LD-/, '').replace(/^0+/, '') || selectedTrip.loadId.replace(/^LD-/, '');
    
    // First check trackingShipments (real data)
    const byId = trackingShipments.find((s: any) => s.id === tripShipmentId);
    if (byId) return byId;
    
    const found = trackingShipments.find((s: any) => {
      const load = s.load || loads.find((l: any) => l.id === s.loadId);
      return (
        load?.shipperLoadNumber?.toString() === loadNum ||
        load?.adminReferenceNumber?.toString() === loadNum ||
        (load?.shipperLoadNumber == null && load?.adminReferenceNumber == null && loadNum && s.loadId?.slice(0, 6) === loadNum.slice(0, 6))
      );
    });
    
    if (found) return found;
    
    // If no real data found, check dummy data
    const dummyMatch = dummyShipments.find((s: any) => s.id === tripShipmentId);
    if (dummyMatch) return dummyMatch;
    
    return null;
  }, [selectedTrip, trackingShipments, loads, dummyShipments]);

  const shipmentId = matchedShipment?.id;
  
  // Don't fetch documents if using dummy data
  const isDummyShipment = shipmentId?.startsWith("dummy-");
  
  const {
    data: shipmentDocuments = [],
    refetch: refetchDocuments,
    isError: documentsFetchError,
    error: documentsFetchErrorDetail,
  } = useQuery<ShipmentDocument[]>({
    queryKey: ["/api/shipments", shipmentId, "documents"],
    enabled: !!shipmentId && !isDummyShipment,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingDocType, setUploadingDocType] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async ({ documentType, file }: { documentType: string; file: File }) => {
      if (!shipmentId) throw new Error("No shipment selected");

      console.log("[DriverTrips][Upload] Starting upload:", {
        documentType,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        shipmentId,
      });

      const { objectPath } = await uploadFileWithPresignedFallback(file);
      if (!objectPath) throw new Error("Server did not return object path");

      console.log("[DriverTrips][Upload] File uploaded, saving document metadata...");
      const result = await apiRequest("POST", `/api/shipments/${shipmentId}/documents`, {
        documentType,
        fileName: file.name,
        fileUrl: objectPath,
        fileSize: file.size,
      });

      console.log("[DriverTrips][Upload] Upload complete:", result);
      return result;
    },
    onSuccess: () => {
      // Invalidate all related queries to update UI immediately
      queryClient.invalidateQueries({ queryKey: ["/api/shipments", shipmentId, "documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shipments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shipments/tracking"] });
      queryClient.invalidateQueries({ queryKey: ["/api/carrier/documents/expiring"] });
      
      toast({ title: "Document Uploaded", description: "Document has been shared with the shipper" });
      setUploadingDocType(null);
      setSelectedFile(null);
      setSelectedDocType("");
      setUploadDialogOpen(false);
      setCameraMode(false);
      setCapturedImage(null);
    },
    onError: (error: Error) => {
      console.error("[DriverTrips][Upload] Upload failed:", error);
      toast({ 
        title: "Upload Failed", 
        description: error.message || "Failed to upload document. Please try again.", 
        variant: "destructive" 
      });
      setUploadingDocType(null);
    },
  });

  function handleDocumentUpload(docLabel: string, file: File) {
    const docType = labelToDocumentType[docLabel];
    if (!docType || !shipmentId || !file) return;
    setUploadingDocType(docType);
    uploadMutation.mutate({ documentType: docType, file });
  }

  function getUploadedDocument(docLabel: string): ShipmentDocument | undefined {
    const docType = labelToDocumentType[docLabel];
    return shipmentDocuments.find(d => d.documentType === docType);
  }

  function getUploadedDocuments(docLabel: string): ShipmentDocument[] {
    const docType = labelToDocumentType[docLabel];
    return shipmentDocuments.filter(d => d.documentType === docType);
  }

  // Camera functions
  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (error) {
      toast({ title: "Camera Error", description: "Could not access camera. Please check permissions.", variant: "destructive" });
      setCameraMode(false);
    }
  }

  function stopCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setCameraMode(false);
    setCapturedImage(null);
  }

  async function switchCamera() {
    // Stop current stream
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
    }
    // Toggle facing mode
    const newFacing = facingMode === "environment" ? "user" : "environment";
    setFacingMode(newFacing);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (error) {
      toast({ title: "Camera Error", description: "Could not switch camera", variant: "destructive" });
    }
  }

  function capturePhoto() {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const imageData = canvas.toDataURL("image/jpeg", 0.9);
        setCapturedImage(imageData);
        // Stop camera after capture
        if (cameraStream) {
          cameraStream.getTracks().forEach(track => track.stop());
          setCameraStream(null);
        }
      }
    }
  }

  function useCapturedImage() {
    if (capturedImage) {
      console.log("[DriverTrips][Camera] Converting captured image to file...");
      // Convert base64 to File
      fetch(capturedImage)
        .then(res => res.blob())
        .then(blob => {
          const file = new File([blob], `document_${Date.now()}.jpg`, { type: "image/jpeg" });
          console.log("[DriverTrips][Camera] Image converted to file:", {
            name: file.name,
            size: file.size,
            type: file.type,
          });
          setSelectedFile(file);
          setCameraMode(false);
          setCapturedImage(null);
          
          // Auto-upload if document type is selected
          if (selectedDocType && shipmentId) {
            console.log("[DriverTrips][Camera] Auto-uploading captured image...");
            uploadMutation.mutate({ 
              documentType: selectedDocType,
              file: file,
            });
            setUploadDialogOpen(false);
          }
        })
        .catch(error => {
          console.error("[DriverTrips][Camera] Failed to convert image:", error);
          toast({
            title: "Image Conversion Failed",
            description: "Failed to process captured image. Please try again.",
            variant: "destructive",
          });
        });
    }
  }

  function retakePhoto() {
    setCapturedImage(null);
    startCamera();
  }

  function openDocumentViewer(docLabel: string) {
    const docType = labelToDocumentType[docLabel];
    
    // For receipts, show all receipts in a carousel
    if (docType === "receipts") {
      const receipts = getUploadedDocuments(docLabel);
      if (receipts.length > 0) {
        setSelectedReceiptDocuments(receipts);
        setCurrentReceiptIndex(0);
        setMultipleReceiptsViewerOpen(true);
      } else {
        toast({ title: "No Receipts", description: "No receipts have been uploaded yet" });
      }
    } else {
      // For other documents, show single document viewer
      const uploadedDoc = getUploadedDocument(docLabel);
      if (uploadedDoc && uploadedDoc.fileUrl) {
        setSelectedDocument({ type: docLabel, image: uploadedDoc.fileUrl });
        setDocumentViewerOpen(true);
      } else {
        toast({ title: "No Document", description: "This document hasn't been uploaded yet" });
      }
    }
  }

  const stats = useMemo(() => {
    const inTransit = activeTrips.filter(t => t.status === "in_transit").length;
    const pickingUp = activeTrips.filter(t => t.status === "awaiting_pickup" || t.status === "picked_up").length;
    const delivering = activeTrips.filter(t => t.status === "out_for_delivery").length;
    const totalRevenue = activeTrips.reduce((sum, t) => sum + (t.rate || 0), 0);
    const avgProgress = activeTrips.length > 0 
      ? Math.round(activeTrips.reduce((sum, t) => sum + (t.progress || 0), 0) / activeTrips.length)
      : 0;
    
    return { inTransit, pickingUp, delivering, totalRevenue, avgProgress };
  }, [activeTrips]);

  const handleStatusUpdate = (newStatus: CarrierTrip["status"]) => {
    if (!selectedTrip) return;
    toast({
      title: "Status Update",
      description: `Use the OTP workflow below to update trip status. Request Start/End OTP and have shipper verify.`,
    });
  };

  if (activeTrips.length === 0) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Active Trips</h1>
        <EmptyState
          icon={Truck}
          title="No active trips"
          description="When shippers accept your bids, your trips will appear here. Browse available loads to start bidding."
        />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold truncate" data-testid="text-trips-title">Trip Intelligence</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Manage your {activeTrips.length} active trips</p>
        </div>
      </div>
      
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          title="Active Trips"
          value={activeTrips.length}
          icon={Truck}
          subtitle="In progress"
          testId="stat-active-trips"
        />
        <StatCard
          title="In Transit"
          value={stats.inTransit}
          icon={Route}
          subtitle="On the road"
          testId="stat-in-transit"
        />
        <StatCard
          title="Picking Up"
          value={stats.pickingUp}
          icon={Package}
          subtitle="At origin"
          testId="stat-picking-up"
        />
        <StatCard
          title="Delivering"
          value={stats.delivering}
          icon={MapPin}
          subtitle="Near destination"
          testId="stat-delivering"
        />
        <StatCard
          title="Trip Revenue"
          value={formatCurrency(stats.totalRevenue)}
          icon={TrendingUp}
          subtitle="All active trips"
          testId="stat-revenue"
        />
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1 flex flex-col lg:h-[calc(100vh-10px)]">
          <CardHeader className="pb-3 px-3 sm:px-4 pt-3 sm:pt-4 shrink-0">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm sm:text-base">Current Trips ({activeTrips.length})</CardTitle>
              <Select value={tripSortOrder} onValueChange={(v) => setTripSortOrder(v as typeof tripSortOrder)}>
                <SelectTrigger className="w-24 sm:w-28 h-8 text-xs" data-testid="select-trip-sort">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="oldest">Oldest</SelectItem>
                  <SelectItem value="status">By Status</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 min-h-0 overflow-hidden">
            <ScrollArea className="h-full w-full">
              <div className="p-2 sm:p-3 space-y-2">
                {activeTrips.map((trip) => (
                  <div
                    key={trip.tripId}
                    className={`p-3 sm:p-4 rounded-lg cursor-pointer hover-elevate ${
                      selectedTrip?.tripId === trip.tripId ? "bg-primary/10 border border-primary/20" : "bg-muted/50"
                    }`}
                    onClick={() => setSelectedTrip(trip)}
                    data-testid={`trip-item-${trip.tripId}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-muted-foreground">{trip.loadId}</span>
                      <Badge className={`${statusConfig[trip.status].color} text-xs no-default-hover-elevate no-default-active-elevate`}>
                        {statusConfig[trip.status].label}
                      </Badge>
                    </div>
                    <div className="font-semibold text-xs sm:text-sm mb-1 truncate">{trip.pickup} to {trip.dropoff}</div>
                    <div className="space-y-1 mb-2">
                      <div className="flex items-start gap-1.5">
                        <MapPin className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs truncate">{trip.pickup}</div>
                          {trip.pickupLocality && (
                            <div className="text-xs text-muted-foreground truncate">{trip.pickupLocality}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <MapPin className="h-3 w-3 text-red-500 mt-0.5 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs truncate">{trip.dropoff}</div>
                          {trip.dropoffBusinessName && (
                            <div className="text-xs font-medium truncate">{trip.dropoffBusinessName}</div>
                          )}
                          {trip.dropoffLocality && (
                            <div className="text-xs text-muted-foreground truncate">{trip.dropoffLocality}</div>
                          )}
                        </div>
                      </div>
                    </div>
                    <Progress value={trip.progress} className="h-2 mb-2" />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate max-w-[80px] sm:max-w-[100px]">{trip.currentLocation}</span>
                      </span>
                      <span className="font-medium text-foreground whitespace-nowrap">{formatCurrency(trip.rate)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 flex flex-col h-auto lg:h-[calc(100vh-10px)]">
          {selectedTrip ? (
            <>
              <CardHeader className="pb-3 border-b border-border flex-shrink-0 px-3 sm:px-4 md:px-6 pt-3 sm:pt-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <CardTitle className="text-base sm:text-lg truncate">{selectedTrip.pickup} to {selectedTrip.dropoff}</CardTitle>
                      <Badge className={`${statusConfig[selectedTrip.status].color} no-default-hover-elevate no-default-active-elevate text-xs`}>
                        {statusConfig[selectedTrip.status].label}
                      </Badge>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:gap-4 md:gap-6 mb-2 space-y-2 sm:space-y-0">
                      <div className="flex items-start gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs sm:text-sm font-medium truncate">{selectedTrip.pickup}</div>
                          {selectedTrip.pickupLocality && (
                            <div className="text-xs text-muted-foreground truncate">{selectedTrip.pickupLocality}</div>
                          )}
                          {selectedTrip.pickupLandmark && (
                            <div className="text-xs text-muted-foreground truncate">Near: {selectedTrip.pickupLandmark}</div>
                          )}
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0 hidden sm:block" />
                      <div className="flex items-start gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-red-500 mt-0.5 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs sm:text-sm font-medium truncate">{selectedTrip.dropoff}</div>
                          {selectedTrip.dropoffBusinessName && (
                            <div className="text-xs font-medium truncate">{selectedTrip.dropoffBusinessName}</div>
                          )}
                          {selectedTrip.dropoffLocality && (
                            <div className="text-xs text-muted-foreground truncate">{selectedTrip.dropoffLocality}</div>
                          )}
                          {selectedTrip.dropoffLandmark && (
                            <div className="text-xs text-muted-foreground truncate">Near: {selectedTrip.dropoffLandmark}</div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground flex-wrap">
                      <span className="truncate">{selectedTrip.loadId}</span>
                      <span className="flex items-center gap-1 truncate">
                        <Building2 className="h-3 w-3 shrink-0" />
                        <span className="truncate">{selectedTrip.shipperName}</span>
                      </span>
                      <span className="font-medium text-foreground whitespace-nowrap">{formatCurrency(selectedTrip.rate)}</span>
                    </div>
                  </div>
                  <div className="text-left sm:text-right shrink-0">
                    <p className="text-xs sm:text-sm text-muted-foreground">ETA</p>
                    <p className="font-semibold text-sm sm:text-base">
                      {format(new Date(selectedTrip.eta), "MMM d, h:mm a")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 sm:gap-4 mt-3">
                  <div className="flex-1">
                    <div className="flex justify-between text-xs sm:text-sm mb-1">
                      <span>
                        {selectedTrip.totalDistance > 0
                          ? `${selectedTrip.completedDistance} km`
                          : "—"}
                      </span>
                      <span>
                        {selectedTrip.totalDistance > 0 ? `${selectedTrip.totalDistance} km` : ""}
                      </span>
                    </div>
                    <Progress value={selectedTrip.progress} />
                  </div>
                  <span className="font-bold text-base sm:text-lg">{selectedTrip.progress}%</span>
                </div>
              </CardHeader>
              
              <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
                <Tabs value={detailTab} onValueChange={setDetailTab} className="flex-1 flex flex-col overflow-hidden">
                  <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0 scrollbar-hide">
                    <TabsList className="w-full sm:w-auto inline-flex justify-start rounded-none border-b px-2 sm:px-4 gap-1 flex-shrink-0 min-w-full sm:min-w-0">
                      <TabsTrigger value="overview" className="text-xs sm:text-sm whitespace-nowrap">Overview</TabsTrigger>
                      <TabsTrigger 
                        value="map" 
                        disabled={!matchedShipment?.startOtpVerified}
                        className="flex items-center gap-1 text-xs sm:text-sm whitespace-nowrap"
                      >
                        {matchedShipment?.startOtpVerified ? (
                          <MapIcon className="h-3 w-3" />
                        ) : (
                          <Lock className="h-3 w-3" />
                        )}
                        Map
                      </TabsTrigger>
                      <TabsTrigger value="documents" className="text-xs sm:text-sm whitespace-nowrap">Documents</TabsTrigger>
                      <TabsTrigger value="receipts" className="text-xs sm:text-sm whitespace-nowrap">Receipts</TabsTrigger>
                    </TabsList>
                  </div>
                  
                  <ScrollArea className="flex-1">
                    <div className="p-3 sm:p-4">
                    <TabsContent value="overview" className="mt-0 space-y-3 sm:space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <Card>
                          <CardContent className="pt-3 sm:pt-4 p-3 sm:p-4 space-y-2">
                            <div className="flex justify-between text-xs sm:text-sm">
                              <span className="text-muted-foreground">Load Type</span>
                              <span className="font-medium truncate ml-2">{selectedTrip.loadType}</span>
                            </div>
                            <div className="flex justify-between text-xs sm:text-sm">
                              <span className="text-muted-foreground">Weight</span>
                              <span className="font-medium">{selectedTrip.weight} Tons</span>
                            </div>
                            <div className="flex justify-between text-xs sm:text-sm">
                              <span className="text-muted-foreground">Driver</span>
                              <span className="font-medium truncate ml-2">{selectedTrip.driverAssigned}</span>
                            </div>
                            <div className="flex justify-between text-xs sm:text-sm">
                              <span className="text-muted-foreground">Truck</span>
                              <span className="font-medium truncate ml-2">{selectedTrip.truckAssigned}</span>
                            </div>
                          </CardContent>
                        </Card>
                        
                        <Card>
                          <CardContent className="pt-3 sm:pt-4 p-3 sm:p-4 space-y-2">
                            <div className="flex justify-between text-xs sm:text-sm">
                              <span className="text-muted-foreground">Trip Rate</span>
                              <span className="font-semibold text-primary">{formatCurrency(selectedTrip.rate)}</span>
                            </div>
                            <div className="flex justify-between text-xs sm:text-sm">
                              <span className="text-muted-foreground">Total Distance</span>
                              <span className="font-medium">
                                {selectedTrip.totalDistance > 0
                                  ? `${selectedTrip.totalDistance} km`
                                  : "—"}
                              </span>
                            </div>
                            <div className="flex justify-between text-xs sm:text-sm">
                              <span className="text-muted-foreground">Stops</span>
                              <span className="font-medium">{selectedTrip.allStops.length}</span>
                            </div>
                            <div className="flex justify-between text-xs sm:text-sm">
                              <span className="text-muted-foreground">Started</span>
                              <span className="font-medium">{format(new Date(selectedTrip.startDate), "MMM d")}</span>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                      
                      <div>
                        <h4 className="font-medium mb-3 text-sm sm:text-base">Route Stops</h4>
                        <div className="space-y-2">
                          {selectedTrip.allStops.map((stop, idx) => (
                            <div key={stop.stopId} className="flex gap-2 sm:gap-3 p-2 sm:p-3 rounded-md bg-muted/50">
                              <div className={`h-7 w-7 sm:h-8 sm:w-8 shrink-0 rounded-full flex items-center justify-center ${
                                stop.status === "completed" 
                                  ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" 
                                  : "bg-muted"
                              }`}>
                                {stop.status === "completed" ? (
                                  <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                ) : (
                                  <span className="text-xs font-medium">{idx + 1}</span>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-medium uppercase text-muted-foreground">{stop.type}</span>
                                  {stop.actualTime && (
                                    <span className="text-xs text-muted-foreground">
                                      {format(new Date(stop.actualTime), "h:mm a")}
                                    </span>
                                  )}
                                </div>
                                <p className="font-medium text-xs sm:text-sm mt-1 break-words">{stop.location}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {matchedShipment ? (
                        <OtpTripActions 
                          shipment={matchedShipment} 
                          onStateChange={() => {
                            refetchShipments();
                            if (matchedShipment.startOtpVerified && detailTab === "overview") {
                              setDetailTab("map");
                            }
                          }}
                          driverPhone={matchedShipment.driverId ? drivers.find(d => d.id === matchedShipment.driverId)?.phone : undefined}
                          carrierPhone={user?.phone ?? undefined}
                          shipmentDocuments={shipmentDocuments}
                        />
                      ) : (
                        // Fallback: Create a minimal shipment object from selectedTrip for dummy data
                        selectedTrip && (
                          <OtpTripActions 
                            shipment={{
                              id: selectedTrip.tripId.replace(/^real-/, ''),
                              loadId: selectedTrip.tripId,
                              status: selectedTrip.status,
                              startOtpRequested: false,
                              startOtpVerified: false,
                              endOtpRequested: false,
                              endOtpVerified: false,
                              driverId: user?.id || "",
                            } as any}
                            onStateChange={() => {
                              refetchShipments();
                            }}
                            driverPhone={user?.phone ?? undefined}
                            carrierPhone={user?.phone ?? undefined}
                            shipmentDocuments={shipmentDocuments}
                          />
                        )
                      )}
                    </TabsContent>
                    
                    <TabsContent value="map" className="mt-0 space-y-3 sm:space-y-4">
                      {matchedShipment?.startOtpVerified ? (
                        <>
                          <Card>
                            <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                              <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                                <MapIcon className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                                Live Shipment Tracking
                              </CardTitle>
                              <CardDescription className="text-xs sm:text-sm">
                                {(matchedShipment as any)?.routeStartOtpVerified 
                                  ? "Truck is on the way to destination" 
                                  : "Route ready - verify Route Start OTP to begin transit"
                                }
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                              <ShipmentMap
                                pickupCity={selectedTrip.pickup}
                                dropoffCity={selectedTrip.dropoff}
                                pickupAddressFull={matchedShipment?.load ? buildFullAddress(matchedShipment.load as any, "pickup") : null}
                                dropoffAddressFull={matchedShipment?.load ? buildFullAddress(matchedShipment.load as any, "dropoff") : null}
                                showTruck={(matchedShipment as any)?.routeStartOtpVerified || false}
                                truckAtPickup={!(matchedShipment as any)?.routeStartOtpVerified}
                                progress={selectedTrip.progress}
                                triptrackLocations={(matchedShipment as any)?.load?.triptrackLocations ?? undefined}
                                currentStage={(matchedShipment as any)?.currentStage}
                                className="h-[250px] sm:h-[300px] md:h-[350px] rounded-lg"
                              />
                            </CardContent>
                          </Card>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                            <Card className={`${matchedShipment.startOtpVerified ? "border-green-200 dark:border-green-800" : ""}`}>
                              <CardContent className="pt-3 sm:pt-4 p-3 sm:p-4">
                                <div className="flex items-center gap-2 sm:gap-3">
                                  <div className={`h-8 w-8 sm:h-10 sm:w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                                    matchedShipment.startOtpVerified 
                                      ? "bg-green-100 dark:bg-green-900/30" 
                                      : "bg-muted"
                                  }`}>
                                    <CheckCircle className={`h-4 w-4 sm:h-5 sm:w-5 ${
                                      matchedShipment.startOtpVerified 
                                        ? "text-green-600 dark:text-green-400" 
                                        : "text-muted-foreground"
                                    }`} />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-medium text-xs sm:text-sm truncate">Trip Start OTP</p>
                                    <p className="text-xs text-muted-foreground">
                                      {matchedShipment.startOtpVerified ? "Verified" : "Pending"}
                                    </p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                            
                            <Card className={`${(matchedShipment as any)?.routeStartOtpVerified ? "border-green-200 dark:border-green-800" : ""}`}>
                              <CardContent className="pt-3 sm:pt-4 p-3 sm:p-4">
                                <div className="flex items-center gap-2 sm:gap-3">
                                  <div className={`h-8 w-8 sm:h-10 sm:w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                                    (matchedShipment as any)?.routeStartOtpVerified 
                                      ? "bg-green-100 dark:bg-green-900/30" 
                                      : "bg-amber-100 dark:bg-amber-900/30"
                                  }`}>
                                    {(matchedShipment as any)?.routeStartOtpVerified ? (
                                      <Truck className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-400" />
                                    ) : (
                                      <Lock className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600 dark:text-amber-400" />
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-medium text-xs sm:text-sm truncate">Route Start OTP</p>
                                    <p className="text-xs text-muted-foreground">
                                      {(matchedShipment as any)?.routeStartOtpVerified 
                                        ? "Truck on route" 
                                        : "Enter to show truck"
                                      }
                                    </p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          </div>
                          
                          {matchedShipment && (
                            <OtpTripActions 
                              shipment={matchedShipment} 
                              onStateChange={() => refetchShipments()}
                              driverPhone={matchedShipment.driverId ? drivers.find(d => d.id === matchedShipment.driverId)?.phone : undefined}
                              carrierPhone={user?.phone ?? undefined}
                              shipmentDocuments={shipmentDocuments}
                            />
                          )}
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-8 sm:py-12 text-center px-4">
                          <Lock className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-3 sm:mb-4" />
                          <h4 className="font-medium mb-2 text-sm sm:text-base">Map View Locked</h4>
                          <p className="text-xs sm:text-sm text-muted-foreground mb-4 max-w-sm">
                            Complete the Trip Start OTP verification to unlock map tracking
                          </p>
                        </div>
                      )}
                    </TabsContent>
                    
                    <TabsContent value="documents" className="mt-0 space-y-3 sm:space-y-4">
                      <Card>
                        <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                          <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                            <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                            Trip Documents
                          </CardTitle>
                          <CardDescription className="text-xs sm:text-sm">
                            Upload documents to share with shipper in real-time
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                          {documentsFetchError && shipmentId ? (
                            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 sm:p-4 text-center space-y-2">
                              <p className="text-sm text-destructive">
                                Could not load documents. {documentsFetchErrorDetail instanceof Error ? documentsFetchErrorDetail.message : "Please try again."}
                              </p>
                              <Button variant="outline" size="sm" onClick={() => refetchDocuments()}>
                                Retry
                              </Button>
                            </div>
                          ) : (
                          <>
                          <div className="space-y-2">
                            {["LR / Consignment Note", "E-way Bill", "Loading Photos", "Proof of Delivery (POD)", "Invoice", "Other Document"].map((docLabel, index) => {
                              const uploadedDoc = getUploadedDocument(docLabel);
                              const docType = labelToDocumentType[docLabel];
                              const isUploading = uploadingDocType === docType && uploadMutation.isPending;
                              
                              return (
                                <div 
                                  key={index} 
                                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 p-2.5 sm:p-3 bg-muted/50 rounded-lg"
                                  data-testid={`trip-document-${index}`}
                                >
                                  <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                                    <div className={`h-7 w-7 sm:h-8 sm:w-8 rounded flex items-center justify-center flex-shrink-0 ${
                                      uploadedDoc ? "bg-green-100 dark:bg-green-900/30" : "bg-primary/10"
                                    }`}>
                                      {uploadedDoc ? (
                                        <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600" />
                                      ) : (
                                        <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                                      )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="font-medium text-xs sm:text-sm truncate">{docLabel}</p>
                                      <p className="text-xs text-muted-foreground truncate">
                                        {uploadedDoc 
                                          ? `Uploaded ${uploadedDoc.createdAt ? format(new Date(uploadedDoc.createdAt), "MMM d, h:mm a") : "recently"}`
                                          : "Not uploaded yet"
                                        }
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 sm:gap-2 justify-end sm:justify-start flex-shrink-0">
                                    {uploadedDoc ? (
                                      <>
                                        <Badge variant="outline" className="text-green-600 border-green-200 dark:border-green-800 text-xs">
                                          Shared
                                        </Badge>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          onClick={() => openDocumentViewer(docLabel)}
                                          data-testid={`button-view-doc-${index}`}
                                          className="h-8 w-8"
                                        >
                                          <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                        </Button>
                                      </>
                                    ) : (
                                      <div className="flex items-center gap-1 sm:gap-1.5">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => {
                                            setSelectedDocType(labelToDocumentType[docLabel]);
                                            setCameraMode(true);
                                            setUploadDialogOpen(true);
                                            startCamera();
                                          }}
                                          disabled={isUploading || !shipmentId}
                                          data-testid={`button-camera-doc-${index}`}
                                          className="h-7 sm:h-8 text-xs px-2 sm:px-3"
                                        >
                                          <Camera className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
                                          <span className="hidden sm:inline">Capture</span>
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => {
                                            setSelectedDocType(labelToDocumentType[docLabel]);
                                            setUploadDialogOpen(true);
                                          }}
                                          disabled={isUploading || !shipmentId}
                                          data-testid={`button-upload-doc-${index}`}
                                          className="h-7 sm:h-8 text-xs px-2 sm:px-3"
                                        >
                                          {isUploading ? (
                                            <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1 animate-spin" />
                                          ) : (
                                            <Upload className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
                                          )}
                                          <span className="hidden sm:inline">Upload</span>
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          {shipmentDocuments.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-3 sm:mt-4 text-center">
                              {shipmentDocuments.length} document(s) shared with shipper
                            </p>
                          )}
                          {!shipmentId && (
                            <p className="text-xs text-muted-foreground mt-3 sm:mt-4 text-center">
                              Document upload will be available when a shipment is linked
                            </p>
                          )}
                          </>
                          )}
                        </CardContent>
                      </Card>
                    </TabsContent>
                    
                    <TabsContent value="receipts" className="mt-0 space-y-3 sm:space-y-4">
                      <Card>
                        <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                          <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                            <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                            Trip Receipts
                          </CardTitle>
                          <CardDescription className="text-xs sm:text-sm">
                            Upload and manage multiple receipts for this trip
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                          {documentsFetchError && shipmentId ? (
                            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 sm:p-4 text-center space-y-2">
                              <p className="text-sm text-destructive">
                                Could not load receipts. {documentsFetchErrorDetail instanceof Error ? documentsFetchErrorDetail.message : "Please try again."}
                              </p>
                              <Button variant="outline" size="sm" onClick={() => refetchDocuments()}>
                                Retry
                              </Button>
                            </div>
                          ) : (
                            <>
                              <div className="space-y-3">
                                {getUploadedDocuments("Receipts").length > 0 ? (
                                  <>
                                    <div className="space-y-2">
                                      {getUploadedDocuments("Receipts").map((receipt, index) => (
                                        <div 
                                          key={receipt.id}
                                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 p-2.5 sm:p-3 bg-muted/50 rounded-lg border border-green-200 dark:border-green-800"
                                          data-testid={`receipt-item-${index}`}
                                        >
                                          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                                            <div className="h-7 w-7 sm:h-8 sm:w-8 rounded flex items-center justify-center flex-shrink-0 bg-green-100 dark:bg-green-900/30">
                                              <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                              <p className="font-medium text-xs sm:text-sm truncate">Receipt #{index + 1}</p>
                                              <p className="text-xs text-muted-foreground truncate">
                                                {receipt.createdAt ? format(new Date(receipt.createdAt), "MMM d, h:mm a") : "Recently uploaded"}
                                              </p>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-1.5 sm:gap-2 justify-end sm:justify-start flex-shrink-0">
                                            <Badge variant="outline" className="text-green-600 border-green-200 dark:border-green-800 text-xs">
                                              Shared
                                            </Badge>
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              onClick={() => {
                                                setSelectedDocument({ type: "Receipt", image: receipt.fileUrl || "" });
                                                setDocumentViewerOpen(true);
                                              }}
                                              data-testid={`button-view-receipt-${index}`}
                                              className="h-8 w-8"
                                            >
                                              <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                            </Button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                    <div className="pt-2 border-t">
                                      <Button
                                        size="sm"
                                        className="w-full"
                                        onClick={() => {
                                          setSelectedDocType("receipts");
                                          setUploadDialogOpen(true);
                                        }}
                                        disabled={!shipmentId}
                                        data-testid="button-add-receipt"
                                      >
                                        <Upload className="h-4 w-4 mr-2" />
                                        Add Another Receipt
                                      </Button>
                                    </div>
                                  </>
                                ) : (
                                  <div className="flex flex-col items-center justify-center py-8 sm:py-12 text-center">
                                    <FileText className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-3 sm:mb-4" />
                                    <h4 className="font-medium mb-2 text-sm sm:text-base">No Receipts Yet</h4>
                                    <p className="text-xs sm:text-sm text-muted-foreground mb-4 max-w-sm">
                                      Upload receipts to share with the shipper. You can upload multiple receipts for this trip.
                                    </p>
                                    <Button
                                      size="sm"
                                      onClick={() => {
                                        setSelectedDocType("receipts");
                                        setUploadDialogOpen(true);
                                      }}
                                      disabled={!shipmentId}
                                      data-testid="button-upload-first-receipt"
                                    >
                                      <Upload className="h-4 w-4 mr-2" />
                                      Upload Receipt
                                    </Button>
                                  </div>
                                )}
                              </div>
                              {getUploadedDocuments("Receipts").length > 0 && (
                                <p className="text-xs text-muted-foreground mt-3 sm:mt-4 text-center">
                                  {getUploadedDocuments("Receipts").length} receipt(s) shared with shipper
                                </p>
                              )}
                              {!shipmentId && (
                                <p className="text-xs text-muted-foreground mt-3 sm:mt-4 text-center">
                                  Receipt upload will be available when a shipment is linked
                                </p>
                              )}
                            </>
                          )}
                        </CardContent>
                      </Card>
                    </TabsContent>
                    </div>
                  </ScrollArea>
                </Tabs>
                
                <div className="border-t p-3 sm:p-4">
                  <h4 className="font-medium mb-3 text-sm sm:text-base">Quick Actions</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Button 
                      onClick={() => handleStatusUpdate("delivered")}
                      disabled={selectedTrip.status === "delivered"}
                      data-testid="button-mark-delivered"
                      size="sm"
                      className="text-xs sm:text-sm"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Mark Delivered
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => setUploadDialogOpen(true)}
                      disabled={!matchedShipment}
                      data-testid="button-upload-documents"
                      size="sm"
                      className="text-xs sm:text-sm"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Documents
                    </Button>
                  </div>
                </div>
              </CardContent>
            </>
          ) : (
            <CardContent className="h-full flex items-center justify-center">
              <p className="text-muted-foreground">Select a trip to view details</p>
            </CardContent>
          )}
        </Card>
      </div>

      <Dialog open={documentViewerOpen} onOpenChange={setDocumentViewerOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
              {selectedDocument?.type}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              View and download this document
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 sm:gap-4">
            {selectedDocument?.image && (() => {
              const url = getDocumentUrl(selectedDocument.image);
              if (!url) return null;
              const lower = selectedDocument.image.toLowerCase();
              const isPdf = lower.endsWith(".pdf");
              return isPdf ? (
                <div className="w-full h-[50vh] sm:h-[60vh] border rounded-lg overflow-hidden">
                  <iframe
                    src={url}
                    className="w-full h-full"
                    title={selectedDocument.type}
                  />
                </div>
              ) : (
                <img
                  src={url}
                  alt={selectedDocument.type}
                  className="max-w-full max-h-[50vh] sm:max-h-[60vh] object-contain rounded-lg border"
                  data-testid="document-image"
                />
              );
            })()}
            <Button 
              variant="outline"
              onClick={() => {
                if (selectedDocument?.image) {
                  const url = getDocumentUrl(selectedDocument.image);
                  if (url) {
                    const link = document.createElement("a");
                    link.href = url;
                    const ext = selectedDocument.image.split(".").pop() || "file";
                  link.download = `${selectedDocument.type.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.${ext}`;
                  link.click();
                }
                }
              }}
              data-testid="button-download-document"
              size="sm"
              className="text-xs sm:text-sm"
            >
              <Download className="h-4 w-4 mr-2" />
              Download Document
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={multipleReceiptsViewerOpen} onOpenChange={setMultipleReceiptsViewerOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
              Receipts ({currentReceiptIndex + 1} of {selectedReceiptDocuments.length})
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              View and download receipts
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 sm:gap-4">
            {selectedReceiptDocuments.length > 0 && selectedReceiptDocuments[currentReceiptIndex] && (() => {
              const currentDoc = selectedReceiptDocuments[currentReceiptIndex];
              if (!currentDoc.fileUrl) return null;
              const url = getDocumentUrl(currentDoc.fileUrl);
              if (!url) return null;
              const lower = currentDoc.fileUrl.toLowerCase();
              const isPdf = lower.endsWith(".pdf");
              return isPdf ? (
                <div className="w-full h-[50vh] sm:h-[60vh] border rounded-lg overflow-hidden">
                  <iframe
                    src={url}
                    className="w-full h-full"
                    title={`Receipt ${currentReceiptIndex + 1}`}
                  />
                </div>
              ) : (
                <img
                  src={url}
                  alt={`Receipt ${currentReceiptIndex + 1}`}
                  className="max-w-full max-h-[50vh] sm:max-h-[60vh] object-contain rounded-lg border"
                  data-testid="receipt-image"
                />
              );
            })()}
            <div className="flex items-center gap-2 w-full justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentReceiptIndex(Math.max(0, currentReceiptIndex - 1))}
                disabled={currentReceiptIndex === 0}
                className="text-xs sm:text-sm"
              >
                ← Previous
              </Button>
              <span className="text-xs sm:text-sm text-muted-foreground">
                {currentReceiptIndex + 1} / {selectedReceiptDocuments.length}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentReceiptIndex(Math.min(selectedReceiptDocuments.length - 1, currentReceiptIndex + 1))}
                disabled={currentReceiptIndex === selectedReceiptDocuments.length - 1}
                className="text-xs sm:text-sm"
              >
                Next →
              </Button>
            </div>
            <Button 
              variant="outline"
              onClick={() => {
                if (selectedReceiptDocuments[currentReceiptIndex]?.fileUrl) {
                  const url = getDocumentUrl(selectedReceiptDocuments[currentReceiptIndex].fileUrl);
                  if (url) {
                    const link = document.createElement("a");
                    link.href = url;
                    const ext = selectedReceiptDocuments[currentReceiptIndex].fileUrl.split(".").pop() || "file";
                    link.download = `receipt_${currentReceiptIndex + 1}.${ext}`;
                    link.click();
                  }
                }
              }}
              data-testid="button-download-receipt"
              size="sm"
              className="text-xs sm:text-sm w-full"
            >
              <Download className="h-4 w-4 mr-2" />
              Download Receipt
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={uploadDialogOpen} onOpenChange={(open) => {
        setUploadDialogOpen(open);
        if (open && shipmentId) refetchDocuments();
        if (!open) {
          setSelectedFile(null);
          setSelectedDocType("lr_consignment");
          stopCamera();
        }
      }}>
        <DialogContent className="w-[95vw] max-w-md max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Upload className="h-4 w-4 shrink-0" />
              Upload Document
            </DialogTitle>
            <DialogDescription className="text-xs">
              Upload images (JPG, PNG), PDF documents, or take a photo
            </DialogDescription>
          </DialogHeader>

          {/* Hidden canvas for capturing photos */}
          <canvas ref={canvasRef} className="hidden" />

          <div className="py-2 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="doc-type" className="text-sm">Document Type</Label>
              <Select value={selectedDocType} onValueChange={setSelectedDocType}>
                <SelectTrigger id="doc-type" data-testid="select-document-type">
                  <SelectValue placeholder="Select document type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lr_consignment">LR / Consignment Note</SelectItem>
                  <SelectItem value="eway_bill">E-way Bill</SelectItem>
                  <SelectItem value="loading_photos">Loading Photos</SelectItem>
                  <SelectItem value="pod">Proof of Delivery (POD)</SelectItem>
                  <SelectItem value="invoice">Invoice</SelectItem>
                  <SelectItem value="receipts">Receipts</SelectItem>
                  <SelectItem value="other">Other Document</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Camera Mode */}
            {cameraMode ? (
              <div className="space-y-3">
                {capturedImage ? (
                  <div className="relative">
                    <img
                      src={capturedImage}
                      alt="Captured"
                      className="w-full rounded-lg border"
                    />
                    <div className="flex gap-2 mt-3">
                      <Button variant="outline" size="sm" className="flex-1" onClick={retakePhoto} data-testid="button-retake">
                        <Camera className="h-4 w-4 mr-2" />
                        Retake
                      </Button>
                      <Button size="sm" className="flex-1" onClick={useCapturedImage} data-testid="button-use-photo">
                        <Check className="h-4 w-4 mr-2" />
                        Use Photo
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full rounded-lg border bg-black aspect-[4/3] object-contain"
                    />
                    <div className="flex flex-col gap-2 mt-3">
                      <Button variant="outline" size="sm" className="w-full" onClick={stopCamera} data-testid="button-cancel-camera">
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                      <Button variant="outline" size="sm" className="w-full" onClick={switchCamera} data-testid="button-switch-camera">
                        <SwitchCamera className="h-4 w-4 mr-2" />
                        Flip
                      </Button>
                      <Button size="sm" className="w-full" onClick={capturePhoto} data-testid="button-capture">
                        <Camera className="h-4 w-4 mr-2" />
                        Capture
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {/* File Selection */}
                <div className="space-y-2">
                  <Label htmlFor="doc-file" className="text-sm">Select File</Label>
                  <Input
                    id="doc-file"
                    type="file"
                    accept="image/*,.pdf,.heic,.heif,image/heic,image/heif"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    data-testid="input-document-file"
                    className="text-sm"
                  />
                </div>

                {/* Or use camera */}
                <div className="relative flex items-center justify-center">
                  <span className="text-xs text-muted-foreground bg-background px-2 relative z-10">OR</span>
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t" />
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="w-full"
                  size="sm"
                  onClick={() => {
                    setCameraMode(true);
                    startCamera();
                  }}
                  data-testid="button-open-camera"
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Take Photo with Camera
                </Button>

                {selectedFile && (
                  <p className="text-xs text-muted-foreground text-center break-all">
                    Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>
            )}
          </div>

          {!cameraMode && (
            <DialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => setUploadDialogOpen(false)}
                data-testid="button-cancel-upload"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => {
                  console.log("[CarrierTrips][UploadButton] Upload button clicked:", {
                    shipmentId,
                    selectedDocType,
                    selectedFile: selectedFile ? {
                      name: selectedFile.name,
                      size: selectedFile.size,
                      type: selectedFile.type,
                    } : null,
                  });

                  if (!shipmentId) {
                    toast({
                      title: "No Shipment Selected",
                      description: "Please select a shipment first",
                      variant: "destructive"
                    });
                    return;
                  }

                  if (!selectedDocType) {
                    toast({
                      title: "No Document Type",
                      description: "Please select a document type",
                      variant: "destructive"
                    });
                    return;
                  }

                  if (!selectedFile) {
                    toast({
                      title: "No File Selected",
                      description: "Please select a file or take a photo",
                      variant: "destructive"
                    });
                    return;
                  }

                  uploadMutation.mutate({
                    documentType: selectedDocType,
                    file: selectedFile,
                  });
                }}
                disabled={uploadMutation.isPending || !selectedDocType || !selectedFile}
                data-testid="button-confirm-upload"
              >
                {uploadMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload
                  </>
                )}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
