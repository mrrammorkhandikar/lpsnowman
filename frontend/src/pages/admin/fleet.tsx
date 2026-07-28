import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { 
  Plus, Search, Truck, MapPin, Package, Edit, Trash2, AlertTriangle, 
  CheckCircle, Clock, Wrench, Filter, ChevronDown, ChevronRight,
  Fuel, Calendar, Shield, FileText, User, Settings, TrendingUp, Eye, Loader2, Pencil
} from "lucide-react";
import { TruckDocumentCard } from "@/components/truck-document-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatCard } from "@/components/stat-card";
import { useCarrierData, type CarrierTruck } from "@/lib/carrier-data-store";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { DialogFooter } from "@/components/ui/dialog";
import type { Truck as DbTruck } from "@shared/schema";
import { indianStates } from "@shared/indian-locations";
import { format, differenceInDays } from "date-fns";
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip 
} from "recharts";

const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];

const statusConfig: Record<CarrierTruck["currentStatus"], { label: string; icon: typeof Truck; color: string }> = {
  "Idle": { label: "Idle", icon: CheckCircle, color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  "On Trip": { label: "On Trip", icon: Truck, color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  "En Route": { label: "En Route", icon: MapPin, color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  "Under Maintenance": { label: "Maintenance", icon: Wrench, color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

function formatDate(date: Date): string {
  return format(new Date(date), "dd MMM yyyy");
}

function getDaysUntilExpiry(date: Date): number {
  return differenceInDays(new Date(date), new Date());
}

function TruckDetailDialog({ truck, onDocumentUpdate }: { truck: CarrierTruck; onDocumentUpdate?: (truckId: string, field: string, value: string) => void }) {
  const [isUploading, setIsUploading] = useState(false);
  
  const handleDocumentUpload = (field: string) => (value: string) => {
    if (onDocumentUpdate) {
      setIsUploading(true);
      onDocumentUpdate(truck.truckId, field, value);
      setIsUploading(false);
    }
  };

  const handleExpiryChange = (field: string) => (dateStr: string) => {
    if (onDocumentUpdate) {
      onDocumentUpdate(truck.truckId, field, dateStr);
    }
  };
  
  return (
    <DialogContent className="w-[95vw] max-w-3xl max-h-[90dvh] flex flex-col p-0 gap-0">
      <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-2 shrink-0">
        <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
          <Truck className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
          {truck.licensePlate}
        </DialogTitle>
        <DialogDescription className="text-xs sm:text-sm">
          {truck.manufacturer} {truck.model} ({truck.makeYear})
        </DialogDescription>
      </DialogHeader>
      
      <Tabs defaultValue="overview" className="flex flex-col flex-1 min-h-0 mt-2">
        <TabsList className="w-full grid grid-cols-3 shrink-0 mx-0 rounded-none border-b px-4 sm:px-6 bg-transparent h-auto pb-0">
          <TabsTrigger value="overview" data-testid="tab-overview" className="text-xs sm:text-sm rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">Overview</TabsTrigger>
          <TabsTrigger value="specs" data-testid="tab-specs" className="text-xs sm:text-sm rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">Specifications</TabsTrigger>
          <TabsTrigger value="documents" data-testid="tab-documents" className="text-xs sm:text-sm rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">Documents</TabsTrigger>
        </TabsList>
        
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
          <TabsContent value="overview" className="space-y-3 sm:space-y-4 mt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <Card>
                <CardContent className="pt-3 sm:pt-4 px-3 sm:px-4">
                  <div className="space-y-2 sm:space-y-3">
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-xs sm:text-sm text-muted-foreground">Status</span>
                      <Badge className={`text-xs ${statusConfig[truck.currentStatus].color}`}>
                        {truck.currentStatus}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-xs sm:text-sm text-muted-foreground shrink-0">Location</span>
                      <span className="font-medium text-xs sm:text-sm text-right break-words max-w-[60%]">{truck.currentLocation}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-xs sm:text-sm text-muted-foreground">Driver</span>
                      <span className="font-medium text-xs sm:text-sm">{truck.assignedDriver || "Unassigned"}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-3 sm:pt-4 px-3 sm:px-4">
                  <div className="space-y-2 sm:space-y-3">
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-xs sm:text-sm text-muted-foreground">Type</span>
                      <span className="font-medium text-xs sm:text-sm">{truck.truckType}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-xs sm:text-sm text-muted-foreground">Capacity</span>
                      <span className="font-medium text-xs sm:text-sm">{truck.loadCapacity} Tons</span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-xs sm:text-sm text-muted-foreground">Body Type</span>
                      <span className="font-medium text-xs sm:text-sm">{truck.bodyType}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="specs" className="space-y-3 sm:space-y-4 mt-0">
            <Card>
              <CardContent className="pt-3 sm:pt-4 px-3 sm:px-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-2 sm:space-y-3">
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-xs sm:text-sm text-muted-foreground">Manufacturer</span>
                      <span className="font-medium text-xs sm:text-sm">{truck.manufacturer}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-xs sm:text-sm text-muted-foreground">Model</span>
                      <span className="font-medium text-xs sm:text-sm">{truck.model}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-xs sm:text-sm text-muted-foreground">Make Year</span>
                      <span className="font-medium text-xs sm:text-sm">{truck.makeYear}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-xs sm:text-sm text-muted-foreground">License Plate</span>
                      <span className="font-medium text-xs sm:text-sm">{truck.licensePlate}</span>
                    </div>
                  </div>
                  <div className="space-y-2 sm:space-y-3">
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-xs sm:text-sm text-muted-foreground shrink-0">Registration</span>
                      <span className="font-medium text-xs sm:text-sm break-all text-right">{truck.registrationNumber}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-xs sm:text-sm text-muted-foreground shrink-0">Chassis</span>
                      <span className="font-medium text-xs sm:text-sm break-all text-right">{truck.chassisNumber}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-xs sm:text-sm text-muted-foreground">Load Capacity</span>
                      <span className="font-medium text-xs sm:text-sm">{truck.loadCapacity} Tons</span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-xs sm:text-sm text-muted-foreground">Body Type</span>
                      <span className="font-medium text-xs sm:text-sm">{truck.bodyType}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="documents" className="space-y-2 sm:space-y-3 mt-0">
            <TruckDocumentCard
              title="Registration Certificate (RC)"
              icon={FileText}
              documentUrl={truck.rcDocumentUrl}
              expiryDate={truck.rcExpiry}
              documentType="rc"
              onUpload={handleDocumentUpload("rcDocumentUrl")}
              onExpiryChange={handleExpiryChange("rcExpiry")}
              isUploading={isUploading}
            />
            <TruckDocumentCard
              title="Insurance Certificate"
              icon={Shield}
              documentUrl={truck.insuranceDocumentUrl}
              expiryDate={truck.insuranceExpiry}
              documentType="insurance"
              onUpload={handleDocumentUpload("insuranceDocumentUrl")}
              onExpiryChange={handleExpiryChange("insuranceExpiry")}
              isUploading={isUploading}
            />
            <TruckDocumentCard
              title="Fitness Certificate"
              icon={CheckCircle}
              documentUrl={truck.fitnessDocumentUrl}
              expiryDate={truck.fitnessExpiry}
              documentType="fitness"
              onUpload={handleDocumentUpload("fitnessDocumentUrl")}
              onExpiryChange={handleExpiryChange("fitnessExpiry")}
              isUploading={isUploading}
            />
            <TruckDocumentCard
              title="Permit"
              icon={FileText}
              documentUrl={truck.permitDocumentUrl}
              expiryDate={truck.permitExpiry}
              documentType="permit"
              onUpload={handleDocumentUpload("permitDocumentUrl")}
              onExpiryChange={handleExpiryChange("permitExpiry")}
              isUploading={isUploading}
            />
            <TruckDocumentCard
              title="PUC Certificate"
              icon={Shield}
              documentUrl={truck.pucDocumentUrl}
              expiryDate={truck.pucExpiry}
              documentType="puc"
              onUpload={handleDocumentUpload("pucDocumentUrl")}
              onExpiryChange={handleExpiryChange("pucExpiry")}
              isUploading={isUploading}
            />
          </TabsContent>
        </div>
      </Tabs>
    </DialogContent>
  );
}

// Sorted states for dropdown
const sortedStates = [...indianStates].sort((a, b) => a.name.localeCompare(b.name));

export default function FleetPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { getFleetOverview } = useCarrierData();
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedTruck, setSelectedTruck] = useState<CarrierTruck | null>(null);
  const [editLocationOpen, setEditLocationOpen] = useState(false);
  const [editingTruckId, setEditingTruckId] = useState<string | null>(null);
  const [editState, setEditState] = useState("");
  const [editCity, setEditCity] = useState("");

  // Get cities for selected state
  const availableCities = editState 
    ? sortedStates.find(s => s.code === editState)?.cities || []
    : [];
  
  // Query backend trucks for real-time updates
  const { data: backendTrucks = [], isLoading: trucksLoading, isSuccess: trucksLoaded, refetch } = useQuery<DbTruck[]>({
    queryKey: ["/api/admin/trucks"],
    refetchOnWindowFocus: true,
  });

  // Mutation to update truck location
  const updateLocationMutation = useMutation({
    mutationFn: async ({ truckId, currentLocation }: { truckId: string; currentLocation: string }) => {
      return apiRequest("PATCH", `/api/trucks/${truckId}`, { currentLocation });
    },
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/trucks"] });
      setEditLocationOpen(false);
      setEditingTruckId(null);
      setEditState("");
      setEditCity("");
      toast({ title: "Location Updated", description: "Truck location has been updated successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update truck location.", variant: "destructive" });
    }
  });

  // Mutation to update truck documents
  const updateDocumentMutation = useMutation({
    mutationFn: async ({ truckId, field, value }: { truckId: string; field: string; value: string }) => {
      return apiRequest("PATCH", `/api/trucks/${truckId}`, { [field]: value });
    },
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/trucks"] });
      toast({ title: "Document Updated", description: "Truck document has been uploaded successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to upload truck document.", variant: "destructive" });
    }
  });

  const handleDocumentUpdate = (truckId: string, field: string, value: string) => {
    updateDocumentMutation.mutate({ truckId, field, value });
  };

  const openEditLocation = (truck: CarrierTruck) => {
    setEditingTruckId(truck.truckId);
    const currentLoc = truck.currentLocation || "";
    // Try to parse existing location in "City, State" format
    if (currentLoc.includes(",")) {
      const [city, stateName] = currentLoc.split(",").map(s => s.trim());
      const foundState = sortedStates.find(s => s.name === stateName);
      if (foundState) {
        setEditState(foundState.code);
        setEditCity(city);
      } else {
        setEditState("");
        setEditCity("");
      }
    } else {
      setEditState("");
      setEditCity("");
    }
    setEditLocationOpen(true);
  };

  const handleSaveLocation = () => {
    if (!editingTruckId) return;
    if (!editState || !editCity) {
      toast({ title: "Error", description: "Please select both state and city.", variant: "destructive" });
      return;
    }
    const stateName = sortedStates.find(s => s.code === editState)?.name || "";
    const finalLocation = `${editCity}, ${stateName}`;
    updateLocationMutation.mutate({ truckId: editingTruckId, currentLocation: finalLocation });
  };

  const trucks: CarrierTruck[] = useMemo(() => {
    if (trucksLoaded) {
      return backendTrucks.map((t) => ({
        truckId: t.id,
        truckType: t.truckType as CarrierTruck["truckType"],
        licensePlate: t.licensePlate,
        registrationNumber: t.registrationNumber || t.licensePlate,
        chassisNumber: t.chassisNumber || "Not specified",
        manufacturer: t.make || "Not specified",
        model: t.model || t.truckType,
        makeYear: t.year || new Date().getFullYear(),
        loadCapacity: t.capacity,
        bodyType: t.bodyType || t.truckType,
        currentLocation: t.currentLocation || "Location not set",
        currentStatus: t.isAvailable ? "Idle" : "On Trip" as CarrierTruck["currentStatus"],
        fuelLevel: 75,
        odometerReading: 50000,
        assignedDriver: null,
        assignedDriverId: null,
        rcExpiry: t.rcExpiry ? new Date(t.rcExpiry) : null,
        insuranceExpiry: t.insuranceExpiry ? new Date(t.insuranceExpiry) : null,
        fitnessExpiry: t.fitnessExpiry ? new Date(t.fitnessExpiry) : null,
        permitExpiry: t.permitExpiry ? new Date(t.permitExpiry) : null,
        pucExpiry: t.pucExpiry ? new Date(t.pucExpiry) : null,
        lastServiceDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        nextServiceDue: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        rcDocumentUrl: t.rcDocumentUrl || null,
        insuranceDocumentUrl: t.insuranceDocumentUrl || null,
        fitnessDocumentUrl: t.fitnessDocumentUrl || null,
        permitDocumentUrl: t.permitDocumentUrl || null,
        pucDocumentUrl: t.pucDocumentUrl || null,
      }));
    }
    return [];
  }, [backendTrucks, trucksLoaded]);
  
  const fleetOverview = useMemo(() => {
    // Use backend-based metrics when backend data is loaded
    if (trucksLoaded) {
      const totalTrucks = trucks.length;
      const activeTrucks = trucks.filter(t => t.currentStatus === "On Trip" || t.currentStatus === "En Route").length;
      const availableNow = trucks.filter(t => t.currentStatus === "Idle").length;
      const underMaintenance = trucks.filter(t => t.currentStatus === "Under Maintenance").length;
      
      // Calculate document expiry alerts
      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      
      const expiryAlerts: { truckId: string; plate: string; documentType: string; expiryDate: Date }[] = [];
      
      trucks.forEach(t => {
        const documents = [
          { type: "Registration Certificate (RC)", date: t.rcExpiry },
          { type: "Insurance", date: t.insuranceExpiry },
          { type: "Fitness Certificate", date: t.fitnessExpiry },
          { type: "Permit", date: t.permitExpiry },
          { type: "PUC Certificate", date: t.pucExpiry }
        ];
        
        documents.forEach(doc => {
          if (!doc.date) return;
          if (doc.date < thirtyDaysFromNow) {
            expiryAlerts.push({
              truckId: t.truckId,
              plate: t.licensePlate,
              documentType: doc.type,
              expiryDate: doc.date
            });
          }
        });
      });
      
      // Sort by expiry date (earliest first)
      expiryAlerts.sort((a, b) => a.expiryDate.getTime() - b.expiryDate.getTime());
      
      return {
        totalTrucks,
        activeTrucks,
        availableNow,
        underMaintenance,
        fleetUtilization: totalTrucks > 0 ? Math.round((activeTrucks / totalTrucks) * 100) : 0,
        truckTypeBreakdown: Object.entries(
          trucks.reduce((acc, t) => {
            acc[t.truckType] = (acc[t.truckType] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)
        ).map(([type, count]) => ({ type, count })),
        documentExpiryAlerts: expiryAlerts.slice(0, 20),
      };
    }
    return getFleetOverview();
  }, [trucks, trucksLoaded, getFleetOverview]);
  
  const filteredTrucks = useMemo(() => {
    return trucks.filter((truck) => {
      const matchesSearch =
        truck.licensePlate.toLowerCase().includes(searchQuery.toLowerCase()) ||
        truck.currentLocation?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        truck.manufacturer.toLowerCase().includes(searchQuery.toLowerCase()) ||
        truck.model.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = typeFilter === "all" || truck.truckType === typeFilter;
      const matchesStatus = statusFilter === "all" || truck.currentStatus === statusFilter;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [trucks, searchQuery, typeFilter, statusFilter]);
  
  const pieChartData = fleetOverview.truckTypeBreakdown.map((item, idx) => ({
    name: item.type,
    value: item.count,
    color: COLORS[idx % COLORS.length]
  }));
  
  const statusData = [
    { name: "Active", count: fleetOverview.activeTrucks, color: "#3B82F6" },
    { name: "Idle", count: fleetOverview.availableNow, color: "#10B981" },
    { name: "Maintenance", count: fleetOverview.underMaintenance, color: "#EF4444" },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-fleet-title">Fleet Intelligence</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Manage your fleet of {trucks.length} trucks</p>
        </div>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="trucks" data-testid="tab-trucks">All Trucks</TabsTrigger>
          <TabsTrigger value="alerts" data-testid="tab-alerts">Alerts</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-4 sm:space-y-6">
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard
              title="Total Trucks"
              value={fleetOverview.totalTrucks}
              icon={Truck}
              subtitle="In your fleet"
              testId="stat-total-trucks"
            />
            <StatCard
              title="Active Trucks"
              value={fleetOverview.activeTrucks}
              icon={TrendingUp}
              subtitle="Currently on trips"
              testId="stat-active-trucks"
            />
            <StatCard
              title="Available Now"
              value={fleetOverview.availableNow}
              icon={CheckCircle}
              subtitle="Ready for dispatch"
              testId="stat-available"
            />
            <StatCard
              title="Under Maintenance"
              value={fleetOverview.underMaintenance}
              icon={Wrench}
              subtitle="Being serviced"
              testId="stat-maintenance"
            />
            <StatCard
              title="Fleet Utilization"
              value={`${fleetOverview.fleetUtilization}%`}
              icon={TrendingUp}
              subtitle="Active / Total"
              testId="stat-utilization"
            />
          </div>
          
          <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
            <Card>
              <CardHeader className="px-4 sm:px-6">
                <CardTitle className="text-base sm:text-lg">Fleet by Type</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Distribution of truck types in your fleet</CardDescription>
              </CardHeader>
              <CardContent className="px-2 sm:px-6">
                <div className="h-64 sm:h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                        labelLine={{ stroke: 'currentColor', strokeWidth: 1 }}
                        style={{ fontSize: '11px' }}
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: '12px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="px-4 sm:px-6">
                <CardTitle className="text-base sm:text-lg">Fleet Status</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Current operational status breakdown</CardDescription>
              </CardHeader>
              <CardContent className="px-2 sm:px-6">
                <div className="h-64 sm:h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={statusData} layout="vertical" margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                      <XAxis type="number" fontSize={10} />
                      <YAxis dataKey="name" type="category" width={80} fontSize={11} />
                      <Tooltip contentStyle={{ fontSize: '12px' }} />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                        {statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {fleetOverview.documentExpiryAlerts.length > 0 && (
            <Card className="border-amber-500">
              <CardHeader className="px-4 sm:px-6">
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-amber-500" />
                  Document Expiry Alerts
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">Documents expiring within 30 days</CardDescription>
              </CardHeader>
              <CardContent className="px-4 sm:px-6">
                <div className="space-y-2">
                  {fleetOverview.documentExpiryAlerts.slice(0, 5).map((alert, idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 rounded-md bg-muted/50">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <FileText className="h-3 w-3 sm:h-4 sm:w-4 text-amber-500 shrink-0" />
                        <div className="text-xs sm:text-sm">
                          <span className="font-medium">{alert.plate}</span>
                          <span className="text-muted-foreground mx-1 sm:mx-2">-</span>
                          <span className="text-muted-foreground">{alert.documentType}</span>
                        </div>
                      </div>
                      <Badge className={`text-xs whitespace-nowrap ${getDaysUntilExpiry(alert.expiryDate) < 0 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                        {getDaysUntilExpiry(alert.expiryDate) < 0 
                          ? "Expired" 
                          : `${getDaysUntilExpiry(alert.expiryDate)} days left`}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="trucks" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by plate, location, manufacturer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-trucks"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-type-filter">
                <SelectValue placeholder="Truck Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Container">Container</SelectItem>
                <SelectItem value="Flatbed">Flatbed</SelectItem>
                <SelectItem value="Open">Open</SelectItem>
                <SelectItem value="Reefer">Reefer</SelectItem>
                <SelectItem value="Tanker">Tanker</SelectItem>
                <SelectItem value="Trailer">Trailer</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-status-filter">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Idle">Idle</SelectItem>
                <SelectItem value="On Trip">On Trip</SelectItem>
                <SelectItem value="En Route">En Route</SelectItem>
                <SelectItem value="Under Maintenance">Under Maintenance</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <Table className="min-w-[900px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs sm:text-sm whitespace-nowrap">License Plate</TableHead>
                      <TableHead className="text-xs sm:text-sm whitespace-nowrap">Type</TableHead>
                      <TableHead className="text-xs sm:text-sm whitespace-nowrap">Manufacturer</TableHead>
                      <TableHead className="text-xs sm:text-sm whitespace-nowrap">Capacity</TableHead>
                      <TableHead className="text-xs sm:text-sm whitespace-nowrap">Location</TableHead>
                      <TableHead className="text-xs sm:text-sm whitespace-nowrap">Driver</TableHead>
                      <TableHead className="text-xs sm:text-sm whitespace-nowrap">Status</TableHead>
                      <TableHead className="text-xs sm:text-sm whitespace-nowrap">Fuel</TableHead>
                      <TableHead className="text-right text-xs sm:text-sm whitespace-nowrap">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTrucks.map((truck) => {
                      const StatusIcon = statusConfig[truck.currentStatus].icon;
                      return (
                        <Dialog key={truck.truckId}>
                          <DialogTrigger asChild>
                            <TableRow 
                              className="cursor-pointer hover-elevate" 
                              data-testid={`row-truck-${truck.truckId}`}
                              onClick={() => setSelectedTruck(truck)}
                            >
                              <TableCell className="font-medium text-xs sm:text-sm whitespace-nowrap">{truck.licensePlate}</TableCell>
                              <TableCell className="text-xs sm:text-sm whitespace-nowrap">{truck.truckType}</TableCell>
                              <TableCell className="text-xs sm:text-sm whitespace-nowrap">{truck.manufacturer}</TableCell>
                              <TableCell className="text-xs sm:text-sm whitespace-nowrap">{truck.loadCapacity} T</TableCell>
                              <TableCell className="text-xs sm:text-sm whitespace-nowrap">{truck.currentLocation}</TableCell>
                              <TableCell className="text-xs sm:text-sm whitespace-nowrap">{truck.assignedDriver || <span className="text-muted-foreground">Unassigned</span>}</TableCell>
                              <TableCell>
                                <Badge className={`text-xs whitespace-nowrap ${statusConfig[truck.currentStatus].color}`}>
                                  <StatusIcon className="h-3 w-3 mr-1" />
                                  {statusConfig[truck.currentStatus].label}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2 whitespace-nowrap">
                                  <Progress value={truck.fuelLevel} className="w-12 sm:w-16 h-2" />
                                  <span className={`text-xs ${truck.fuelLevel < 25 ? "text-red-500" : ""}`}>
                                    {truck.fuelLevel}%
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-7 w-7 sm:h-8 sm:w-8"
                                    onClick={(e) => { e.stopPropagation(); openEditLocation(truck); }} 
                                    data-testid={`button-edit-location-${truck.truckId}`}
                                    title="Edit Location"
                                  >
                                    <Pencil className="h-3 w-3 sm:h-4 sm:w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" data-testid={`button-view-${truck.truckId}`} title="View Details">
                                    <Eye className="h-3 w-3 sm:h-4 sm:w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          </DialogTrigger>
                          <TruckDetailDialog truck={truck} onDocumentUpdate={handleDocumentUpdate} />
                        </Dialog>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
          
          <p className="text-xs sm:text-sm text-muted-foreground">
            Showing {filteredTrucks.length} of {trucks.length} trucks
          </p>
        </TabsContent>
        
        <TabsContent value="alerts" className="space-y-4">
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  Expired Documents
                </CardTitle>
              </CardHeader>
              <CardContent>
                {fleetOverview.documentExpiryAlerts.filter(a => getDaysUntilExpiry(a.expiryDate) < 0).length === 0 ? (
                  <p className="text-muted-foreground">No expired documents</p>
                ) : (
                  <div className="space-y-2">
                    {fleetOverview.documentExpiryAlerts
                      .filter(a => getDaysUntilExpiry(a.expiryDate) < 0)
                      .map((alert, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 rounded-md bg-red-50 dark:bg-red-900/20">
                          <div className="flex items-center gap-3">
                            <FileText className="h-4 w-4 text-red-500" />
                            <div>
                              <span className="font-medium">{alert.plate}</span>
                              <span className="text-muted-foreground mx-2">-</span>
                              <span className="text-muted-foreground">{alert.documentType}</span>
                            </div>
                          </div>
                          <Badge className="bg-red-100 text-red-700">
                            Expired {Math.abs(getDaysUntilExpiry(alert.expiryDate))} days ago
                          </Badge>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Expiring Soon (Within 30 Days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {fleetOverview.documentExpiryAlerts.filter(a => getDaysUntilExpiry(a.expiryDate) >= 0).length === 0 ? (
                  <p className="text-muted-foreground">No documents expiring soon</p>
                ) : (
                  <div className="space-y-2">
                    {fleetOverview.documentExpiryAlerts
                      .filter(a => getDaysUntilExpiry(a.expiryDate) >= 0)
                      .map((alert, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 rounded-md bg-amber-50 dark:bg-amber-900/20">
                          <div className="flex items-center gap-3">
                            <FileText className="h-4 w-4 text-amber-500" />
                            <div>
                              <span className="font-medium">{alert.plate}</span>
                              <span className="text-muted-foreground mx-2">-</span>
                              <span className="text-muted-foreground">{alert.documentType}</span>
                            </div>
                          </div>
                          <Badge className="bg-amber-100 text-amber-700">
                            {getDaysUntilExpiry(alert.expiryDate)} days left
                          </Badge>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Fuel className="h-5 w-5 text-amber-500" />
                  Low Fuel Alerts
                </CardTitle>
              </CardHeader>
              <CardContent>
                {trucks.filter(t => t.fuelLevel < 25).length === 0 ? (
                  <p className="text-muted-foreground">No trucks with low fuel</p>
                ) : (
                  <div className="space-y-2">
                    {trucks
                      .filter(t => t.fuelLevel < 25)
                      .map((truck) => (
                        <div key={truck.truckId} className="flex items-center justify-between p-3 rounded-md bg-amber-50 dark:bg-amber-900/20">
                          <div className="flex items-center gap-3">
                            <Fuel className="h-4 w-4 text-amber-500" />
                            <div>
                              <span className="font-medium">{truck.licensePlate}</span>
                              <span className="text-muted-foreground mx-2">-</span>
                              <span className="text-muted-foreground">{truck.currentLocation}</span>
                            </div>
                          </div>
                          <Badge className={truck.fuelLevel < 15 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}>
                            {truck.fuelLevel}% fuel
                          </Badge>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card> */}
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Location Dialog */}
      <Dialog open={editLocationOpen} onOpenChange={setEditLocationOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Edit Truck Location
            </DialogTitle>
            <DialogDescription>
              Update the current location for this truck
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Select 
                value={editState} 
                onValueChange={(val) => {
                  setEditState(val);
                  setEditCity(""); // Reset city when state changes
                }}
              >
                <SelectTrigger data-testid="select-edit-state">
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  {sortedStates.map((state) => (
                    <SelectItem key={state.code} value={state.code}>{state.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Select 
                value={editCity} 
                onValueChange={setEditCity}
                disabled={!editState}
              >
                <SelectTrigger data-testid="select-edit-city">
                  <SelectValue placeholder={editState ? "Select city" : "Select state first"} />
                </SelectTrigger>
                <SelectContent>
                  {availableCities.map((city) => (
                    <SelectItem key={city.name} value={city.name}>
                      {city.name}{city.isMetro && " (Metro)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditLocationOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveLocation}
              disabled={updateLocationMutation.isPending || !editState || !editCity}
              data-testid="button-save-location"
            >
              {updateLocationMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <MapPin className="h-4 w-4 mr-2" />
              )}
              Save Location
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
