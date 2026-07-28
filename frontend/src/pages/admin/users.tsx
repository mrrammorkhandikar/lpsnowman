import { useState, useMemo, useEffect } from "react";
import { useLocation, useSearch, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { 
  Users, 
  Plus, 
  Search, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Key,
  UserCheck,
  UserX,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Mail,
  Phone,
  Shield,
  Building,
  RefreshCw,
  FileCheck,
  Truck,
  Package,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAdminData, type AdminUser } from "@/lib/admin-data-store";
import { apiGet, parseJsonResponse } from "@/lib/api-client";
import { format } from "date-fns";

type TabType = "shippers" | "carriers" | "admins";

export default function AdminUsersPage() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const params = useParams<{ id?: string }>();
  const { toast } = useToast();
  const { users, addUser, updateUser, suspendUser, activateUser, deleteUser, refreshFromShipperPortal, showAllUsers, setShowAllUsers, refetchUsers } = useAdminData();

  // Fresh list when opening this page (no global 30s polling anymore — avoids 504s under load).
  useEffect(() => {
    void refetchUsers();
  }, [refetchUsers]);
  
  const [activeTab, setActiveTab] = useState<TabType>("shippers");
  const [searchQuery, setSearchQuery] = useState("");
  const [isReloading, setIsReloading] = useState(false);
  const [isPortalSyncing, setIsPortalSyncing] = useState(false);
  
  const handleReload = async () => {
    setIsReloading(true);
    try {
      await refetchUsers();
      toast({
        title: "Users refreshed",
        description: "User list has been updated successfully",
      });
    } catch (error) {
      toast({
        title: "Refresh failed",
        description: "Failed to refresh user list. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsReloading(false);
    }
  };

  const handleSyncPortal = async () => {
    setIsPortalSyncing(true);
    try {
      await refreshFromShipperPortal();
      toast({
        title: "Portal sync complete",
        description: "Users and related data were refreshed from the server.",
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Please try again.";
      toast({
        title: "Sync failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsPortalSyncing(false);
    }
  };

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [carrierSubFilter, setCarrierSubFilter] = useState<string>("all");
  const [highlightUserId, setHighlightUserId] = useState<string | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profileUser, setProfileUser] = useState<AdminUser | null>(null);
  
  useEffect(() => {
    const urlParams = new URLSearchParams(searchString);
    const userId = urlParams.get("userId");
    const role = urlParams.get("role");
    
    if (role) {
      if (role === "shipper") setActiveTab("shippers");
      else if (role === "carrier") setActiveTab("carriers");
      else if (role === "admin") setActiveTab("admins");
    }
    if (userId) {
      setHighlightUserId(userId);
      const user = users.find(u => u.userId === userId);
      if (user) {
        setSearchQuery(user.email || user.name || "");
        if (user.role === "shipper") setActiveTab("shippers");
        else if (user.role === "carrier") setActiveTab("carriers");
        else if (user.role === "admin") setActiveTab("admins");
      }
    }
  }, [searchString, users]);

  useEffect(() => {
    if (params.id && users.length > 0) {
      const user = users.find(u => u.userId === params.id);
      if (user) {
        setProfileUser(user);
        setIsProfileOpen(true);
      }
    }
  }, [params.id, users]);

  const [sortField, setSortField] = useState<keyof AdminUser>("dateJoined");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [createPassword, setCreatePassword] = useState("");
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [adminAccessType, setAdminAccessType] = useState<"full" | "role_based">("full");
  const [selectedAdminRoleId, setSelectedAdminRoleId] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    role: "shipper" as "shipper" | "carrier" | "admin",
    company: "",
    status: "active" as "active" | "inactive" | "suspended" | "pending",
    region: "North India" as string,
  });
  const itemsPerPage = 10;

  const { data: assignableAdminRoles = [] } = useQuery<
    Array<{ id: string; name: string; description?: string | null }>
  >({
    queryKey: ["/api/admin/roles/assignable"],
    queryFn: async () => {
      const res = await apiGet("api/admin/roles/assignable");
      if (!res.ok) return [];
      return parseJsonResponse(res);
    },
    enabled: isAddModalOpen || isEditModalOpen,
  });

  const shippers = useMemo(() => users.filter(u => u.role === "shipper"), [users]);
  const carriers = useMemo(() => users.filter(u => u.role === "carrier"), [users]);
  const admins = useMemo(() => users.filter(u => u.role === "admin"), [users]);

  const tabUsers = useMemo(() => {
    switch (activeTab) {
      case "shippers": return shippers;
      case "carriers": return carriers;
      case "admins": return admins;
      default: return users;
    }
  }, [activeTab, shippers, carriers, admins, users]);

  const filteredUsers = useMemo(() => {
    let result = [...tabUsers];
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(user => 
        user.name?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query) ||
        user.company?.toLowerCase().includes(query) ||
        user.displayUserId?.toLowerCase().includes(query) ||
        (user.userNumber && String(user.userNumber).includes(query))
      );
    }
    
    if (statusFilter !== "all") {
      result = result.filter(user => user.status === statusFilter);
    }

    if (activeTab === "carriers" && carrierSubFilter !== "all") {
      result = result.filter(user => {
        const ct = user.carrierType?.toLowerCase() || "";
        if (carrierSubFilter === "solo") return ct === "solo";
        if (carrierSubFilter === "fleet") return ct === "fleet" || ct === "enterprise";
        return true;
      });
    }
    
    result.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      const direction = sortDirection === "asc" ? 1 : -1;
      
      if (aVal instanceof Date && bVal instanceof Date) {
        return (aVal.getTime() - bVal.getTime()) * direction;
      }
      
      const aStr = String(aVal || "");
      const bStr = String(bVal || "");
      if (aStr < bStr) return -1 * direction;
      if (aStr > bStr) return 1 * direction;
      return 0;
    });
    
    return result;
  }, [tabUsers, searchQuery, statusFilter, carrierSubFilter, activeTab, sortField, sortDirection]);

  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredUsers.slice(start, start + itemsPerPage);
  }, [filteredUsers, currentPage]);

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery, statusFilter, carrierSubFilter]);

  const handleSort = (field: keyof AdminUser) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const resetForm = () => {
    setCreatePassword("");
    setAdminAccessType("full");
    setSelectedAdminRoleId("");
    setFormData({
      name: "",
      email: "",
      phone: "",
      role: "shipper",
      company: "",
      status: "active",
      region: "North India",
    });
  };

  const handleResetPassword = (user: AdminUser) => {
    toast({
      title: "Password Reset",
      description: `Password reset email sent to ${user.email}`,
    });
  };

  const handleToggleStatus = (user: AdminUser) => {
    if (user.status === "active") {
      suspendUser(user.userId);
      toast({
        title: "User Suspended",
        description: `${user.name} has been suspended`,
      });
    } else {
      activateUser(user.userId);
      toast({
        title: "User Activated",
        description: `${user.name} has been activated`,
      });
    }
  };

  const handleDeleteUser = () => {
    if (selectedUser) {
      deleteUser(selectedUser.userId);
      toast({
        title: "User Deleted",
        description: `${selectedUser.name} has been removed`,
      });
      setIsDeleteModalOpen(false);
      setSelectedUser(null);
    }
  };

  const handleCreateUser = async () => {
    if (!formData.name.trim() || !formData.email.trim() || !createPassword) {
      toast({
        title: "Missing fields",
        description: "Full name, email, and password are required.",
        variant: "destructive",
      });
      return;
    }
    if (formData.role === "admin" && adminAccessType === "role_based" && !selectedAdminRoleId) {
      toast({
        title: "Admin role required",
        description: "Select a role for this role-based admin.",
        variant: "destructive",
      });
      return;
    }
    setIsSavingUser(true);
    const result = await addUser({
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      role: formData.role,
      company: formData.company,
      status: formData.status,
      isVerified: formData.status === "active",
      region: formData.region,
      password: createPassword,
      ...(formData.role === "admin" && adminAccessType === "role_based" && selectedAdminRoleId
        ? { adminRoleId: selectedAdminRoleId }
        : {}),
    });
    setIsSavingUser(false);
    if (result.ok) {
      toast({
        title: "User Created",
        description: `${formData.name} has been added successfully`,
      });
      setIsAddModalOpen(false);
      resetForm();
    } else {
      toast({
        title: "Could not create user",
        description: result.message,
        variant: "destructive",
      });
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    if (!formData.name.trim() || !formData.email.trim()) {
      toast({
        title: "Missing fields",
        description: "Full name and email are required.",
        variant: "destructive",
      });
      return;
    }
    const normEmail = (value: string) => value.trim().toLowerCase();
    const updates: Partial<AdminUser> = {};
    if (formData.name.trim() !== (selectedUser.name || "").trim()) updates.name = formData.name;
    if (normEmail(formData.email) !== normEmail(selectedUser.email || "")) updates.email = formData.email;
    if ((formData.phone || "").trim() !== (selectedUser.phone || "").trim()) updates.phone = formData.phone;
    if (formData.role !== selectedUser.role) updates.role = formData.role;
    if ((formData.company || "").trim() !== (selectedUser.company || "").trim()) updates.company = formData.company;
    if (formData.status !== selectedUser.status) updates.status = formData.status;
    if (formData.role === "admin") {
      if (adminAccessType === "full" && !selectedUser.isFullAdmin) {
        updates.isFullAdmin = true;
        updates.adminRoleId = null;
      } else if (adminAccessType === "role_based" && selectedAdminRoleId) {
        if (
          selectedAdminRoleId !== (selectedUser.adminRoleId || "") ||
          selectedUser.isFullAdmin
        ) {
          updates.adminRoleId = selectedAdminRoleId;
        }
      }
    } else if (selectedUser.role === "admin") {
      updates.adminRoleId = null;
    }

    if (Object.keys(updates).length === 0) {
      toast({
        title: "No changes",
        description: "No fields were modified.",
      });
      return;
    }

    setIsSavingUser(true);
    const result = await updateUser(selectedUser.userId, updates);
    setIsSavingUser(false);
    if (result.ok) {
      toast({
        title: "User Updated",
        description: `${formData.name}'s details have been updated`,
      });
      setIsEditModalOpen(false);
      setSelectedUser(null);
    } else {
      toast({
        title: "Could not update user",
        description: result.message,
        variant: "destructive",
      });
    }
  };

  const openEditModal = (user: AdminUser) => {
    setSelectedUser(user);
    setAdminAccessType(user.role === "admin" && user.adminRoleId ? "role_based" : "full");
    setSelectedAdminRoleId(user.adminRoleId || "");
    setFormData({
      name: user.name || "",
      email: user.email || "",
      phone: user.phone || "",
      role: (user.role as "shipper" | "carrier" | "admin") || "shipper",
      company: user.company || "",
      status: user.status || "active",
      region: user.region || "North India",
    });
    setIsEditModalOpen(true);
  };

  const openDetailsModal = (user: AdminUser) => {
    setSelectedUser(user);
    setIsDetailsModalOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active": return <Badge className="bg-green-600">Active</Badge>;
      case "inactive": return <Badge variant="outline" className="text-amber-600 border-amber-400">Inactive</Badge>;
      case "suspended": return <Badge variant="destructive">Suspended</Badge>;
      case "pending": return <Badge variant="secondary">Pending</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getSubTypeBadge = (user: AdminUser) => {
    if (user.role === "carrier") {
      const ct = user.carrierType?.toLowerCase() || "";
      if (ct === "solo") return <Badge variant="outline" className="text-blue-600 border-blue-400">Solo Driver</Badge>;
      if (ct === "fleet" || ct === "enterprise") return <Badge variant="outline" className="text-purple-600 border-purple-400">Fleet Owner</Badge>;
      return <Badge variant="outline" className="text-muted-foreground">Unknown</Badge>;
    }
    if (user.role === "shipper") {
      const sr = user.shipperRole?.toLowerCase() || "";
      if (sr === "transporter") return <Badge variant="outline" className="text-orange-600 border-orange-400">Transporter</Badge>;
      return <Badge variant="outline" className="text-blue-600 border-blue-400">Shipper</Badge>;
    }
    if (user.role === "admin") {
      if (user.isFullAdmin || !user.adminRoleId) {
        return <Badge variant="outline" className="text-red-600 border-red-400">Full Admin</Badge>;
      }
      return (
        <Badge variant="outline" className="text-violet-600 border-violet-400">
          {user.adminRoleName || "Role-based"}
        </Badge>
      );
    }
    return null;
  };

  const renderAdminAccessFields = (idPrefix: string) => {
    if (formData.role !== "admin") return null;
    return (
      <div className="space-y-3 rounded-md border p-3 bg-muted/30">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-admin-access-type`}>Admin access</Label>
          <Select
            value={adminAccessType}
            onValueChange={(v) => {
              const next = v as "full" | "role_based";
              setAdminAccessType(next);
              if (next === "full") setSelectedAdminRoleId("");
            }}
          >
            <SelectTrigger id={`${idPrefix}-admin-access-type`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="full">Full admin (all pages)</SelectItem>
              <SelectItem value="role_based">Role-based admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {adminAccessType === "role_based" ? (
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-admin-role`}>Admin role</Label>
            <Select value={selectedAdminRoleId} onValueChange={setSelectedAdminRoleId}>
              <SelectTrigger id={`${idPrefix}-admin-role`}>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {assignableAdminRoles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {assignableAdminRoles.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No roles available. Create one under Admin Roles first.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  };

  const soloCount = carriers.filter(c => c.carrierType?.toLowerCase() === "solo").length;
  const fleetCount = carriers.filter(c => c.carrierType?.toLowerCase() === "fleet" || c.carrierType?.toLowerCase() === "enterprise").length;
  const transporterCount = shippers.filter(s => s.shipperRole?.toLowerCase() === "transporter").length;
  const shipperOnlyCount = shippers.length - transporterCount;

  const renderStats = () => {
    const activeCount = tabUsers.filter(u => u.status === "active").length;
    const inactiveCount = tabUsers.filter(u => u.status === "inactive").length;
    const pendingCount = tabUsers.filter(u => u.status === "pending").length;

    if (activeTab === "shippers") {
      return (
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-3 sm:pt-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30 shrink-0">
                  <Package className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">Total Shippers</p>
                  <p className="text-lg sm:text-xl font-bold">{shippers.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-3 sm:pt-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30 shrink-0">
                  <Package className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">Shippers</p>
                  <p className="text-lg sm:text-xl font-bold">{shipperOnlyCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-3 sm:pt-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30 shrink-0">
                  <Truck className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">Transporters</p>
                  <p className="text-lg sm:text-xl font-bold">{transporterCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-3 sm:pt-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30 shrink-0">
                  <UserCheck className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">Active</p>
                  <p className="text-lg sm:text-xl font-bold">{activeCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    if (activeTab === "carriers") {
      return (
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-3 sm:pt-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30 shrink-0">
                  <Truck className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">Total Carriers</p>
                  <p className="text-lg sm:text-xl font-bold">{carriers.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-3 sm:pt-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30 shrink-0">
                  <Users className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">Solo Drivers</p>
                  <p className="text-lg sm:text-xl font-bold">{soloCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-3 sm:pt-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30 shrink-0">
                  <Building className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">Fleet Owners</p>
                  <p className="text-lg sm:text-xl font-bold">{fleetCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-3 sm:pt-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30 shrink-0">
                  <UserCheck className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">Active</p>
                  <p className="text-lg sm:text-xl font-bold">{activeCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardContent className="pt-3 sm:pt-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30 shrink-0">
                <ShieldCheck className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Total Admins</p>
                <p className="text-lg sm:text-xl font-bold">{admins.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 sm:pt-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30 shrink-0">
                <UserCheck className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Active</p>
                <p className="text-lg sm:text-xl font-bold">{activeCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 sm:pt-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30 shrink-0">
                <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Inactive</p>
                <p className="text-lg sm:text-xl font-bold">{inactiveCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setLocation("/admin")}
              data-testid="button-back-to-dashboard"
              className="shrink-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl sm:text-2xl font-bold truncate">Users Management</h1>
          </div>
          <p className="text-sm text-muted-foreground ml-10 truncate">
            {showAllUsers ? "All platform users" : "Verified users"} ({users.length} total)
          </p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <Button variant="outline" onClick={handleReload} disabled={isReloading} data-testid="button-reload-users" className="w-full sm:w-auto justify-center">
            <RefreshCw className={`h-4 w-4 mr-2 ${isReloading ? 'animate-spin' : ''}`} />
            {isReloading ? 'Refreshing...' : 'Reload'}
          </Button>
          <Button variant="outline" onClick={() => void handleSyncPortal()} disabled={isPortalSyncing} data-testid="button-sync-users" className="w-full sm:w-auto justify-center">
            <RefreshCw className={`h-4 w-4 mr-2 ${isPortalSyncing ? "animate-spin" : ""}`} />
            {isPortalSyncing ? "Syncing…" : "Sync portal"}
          </Button>
          <Button onClick={() => { resetForm(); setIsAddModalOpen(true); }} data-testid="button-add-user" className="w-full sm:w-auto justify-center">
            <Plus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        </div>
      </div>

      <div className="relative border-b overflow-hidden">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide pb-px">
          <Button
            variant="ghost"
            className={`rounded-none border-b-2 px-3 sm:px-4 whitespace-nowrap shrink-0 ${activeTab === "shippers" ? "border-primary text-primary font-semibold" : "border-transparent text-muted-foreground"}`}
            onClick={() => setActiveTab("shippers")}
            data-testid="tab-shippers"
          >
            <Package className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="text-xs sm:text-sm">Shippers & Transporters</span>
            <Badge variant="secondary" className="ml-1 sm:ml-2 text-xs">{shippers.length}</Badge>
          </Button>
          <Button
            variant="ghost"
            className={`rounded-none border-b-2 px-3 sm:px-4 whitespace-nowrap shrink-0 ${activeTab === "carriers" ? "border-primary text-primary font-semibold" : "border-transparent text-muted-foreground"}`}
            onClick={() => setActiveTab("carriers")}
            data-testid="tab-carriers"
          >
            <Truck className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="text-xs sm:text-sm">Carriers</span>
            <Badge variant="secondary" className="ml-1 sm:ml-2 text-xs">{carriers.length}</Badge>
          </Button>
          <Button
            variant="ghost"
            className={`rounded-none border-b-2 px-3 sm:px-4 whitespace-nowrap shrink-0 ${activeTab === "admins" ? "border-primary text-primary font-semibold" : "border-transparent text-muted-foreground"}`}
            onClick={() => setActiveTab("admins")}
            data-testid="tab-admins"
          >
            <ShieldCheck className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="text-xs sm:text-sm">Admins</span>
            <Badge variant="secondary" className="ml-1 sm:ml-2 text-xs">{admins.length}</Badge>
          </Button>
        </div>
      </div>

      {renderStats()}

      <Card>
        <CardHeader className="pb-3 sm:pb-4">
          <div className="flex flex-col gap-3 sm:gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by user ID, name, email, or company..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-users"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {activeTab === "carriers" && (
                <Select value={carrierSubFilter} onValueChange={setCarrierSubFilter}>
                  <SelectTrigger className="w-full sm:w-[140px]" data-testid="select-carrier-type-filter">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="solo">Solo Drivers</SelectItem>
                    <SelectItem value="fleet">Fleet Owners</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[130px]" data-testid="select-status-filter">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant={showAllUsers ? "default" : "outline"}
                size="sm"
                onClick={() => setShowAllUsers(!showAllUsers)}
                data-testid="button-toggle-all-users"
                className="w-full sm:w-auto"
              >
                {showAllUsers ? "All Users" : "Verified Only"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[90px]">
                    <span className="text-xs">ID</span>
                  </TableHead>
                  <TableHead className="w-[200px]">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 -ml-3"
                      onClick={() => handleSort("name")}
                      data-testid="button-sort-name"
                    >
                      User
                      <ArrowUpDown className="ml-2 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 -ml-3"
                      onClick={() => handleSort("dateJoined")}
                      data-testid="button-sort-created"
                    >
                      Joined
                      <ArrowUpDown className="ml-2 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedUsers.map((user) => (
                    <TableRow 
                      key={user.userId} 
                      className={`cursor-pointer ${user.userId === highlightUserId ? "bg-primary/10 ring-2 ring-primary/30" : ""}`}
                      onClick={() => openDetailsModal(user)}
                      data-testid={`row-user-${user.userId}`}
                    >
                      <TableCell>
                        {user.displayUserId && (
                          <span className="text-xs font-mono font-semibold text-primary" data-testid={`text-userid-${user.userId}`}>
                            {user.displayUserId}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                            <Users className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium flex items-center flex-wrap gap-1 sm:gap-2 text-sm sm:text-base" data-testid={`text-username-${user.userId}`}>
                              <span className="truncate">{user.name}</span>
                              {user.isVerified && (
                                <Shield className="h-3 w-3 text-primary shrink-0" />
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                              <Building className="h-3 w-3 shrink-0" />
                              <span className="truncate">{user.company || "No company"}</span>
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm truncate" data-testid={`text-email-${user.userId}`}>
                            <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span className="truncate">{user.email}</span>
                          </div>
                          <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
                            <Phone className="h-3 w-3 shrink-0" />
                            {user.phone || "No phone"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell data-testid={`badge-type-${user.userId}`}>
                        {getSubTypeBadge(user)}
                      </TableCell>
                      <TableCell data-testid={`badge-status-${user.userId}`}>
                        {getStatusBadge(user.status)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground" data-testid={`text-created-${user.userId}`}>
                        {format(user.dateJoined, "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" data-testid={`button-user-actions-${user.userId}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(user);
                            }} data-testid={`menu-edit-${user.userId}`}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit User
                            </DropdownMenuItem>
                            {user.role === "shipper" && (
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                setLocation("/admin/onboarding");
                              }} data-testid={`menu-view-onboarding-${user.userId}`}>
                                <FileCheck className="h-4 w-4 mr-2" />
                                View Onboarding
                              </DropdownMenuItem>
                            )}
                            {user.role === "carrier" && (
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                setLocation("/admin/verification");
                              }} data-testid={`menu-view-verification-${user.userId}`}>
                                <Truck className="h-4 w-4 mr-2" />
                                View Verification
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              handleResetPassword(user);
                            }} data-testid={`menu-reset-password-${user.userId}`}>
                              <Key className="h-4 w-4 mr-2" />
                              Reset Password
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              handleToggleStatus(user);
                            }} data-testid={`menu-toggle-status-${user.userId}`}>
                              {user.status === "active" ? (
                                <>
                                  <UserX className="h-4 w-4 mr-2" />
                                  Suspend
                                </>
                              ) : (
                                <>
                                  <UserCheck className="h-4 w-4 mr-2" />
                                  Activate
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedUser(user);
                                setIsDeleteModalOpen(true);
                              }}
                              data-testid={`menu-delete-${user.userId}`}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {filteredUsers.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t">
              <p className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left" data-testid="text-pagination-info">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredUsers.length)} of {filteredUsers.length} users
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  data-testid="button-prev-page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs sm:text-sm px-2 whitespace-nowrap">
                  Page {currentPage} of {totalPages || 1}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages || totalPages === 0}
                  data-testid="button-next-page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>Create a new user account</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="add-name">Full Name</Label>
                <Input 
                  id="add-name" 
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  data-testid="input-add-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-email">Email</Label>
                <Input 
                  id="add-email" 
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  data-testid="input-add-email"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-password">Initial password</Label>
              <Input
                id="add-password"
                type="password"
                autoComplete="new-password"
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
                data-testid="input-add-password"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="add-phone">Phone</Label>
                <Input 
                  id="add-phone" 
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  data-testid="input-add-phone"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-role">Role</Label>
                <Select value={formData.role} onValueChange={(v) => {
                  const role = v as "shipper" | "carrier" | "admin";
                  setFormData(prev => ({ ...prev, role }));
                  if (role !== "admin") {
                    setAdminAccessType("full");
                    setSelectedAdminRoleId("");
                  }
                }}>
                  <SelectTrigger data-testid="select-add-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="shipper">Shipper</SelectItem>
                    <SelectItem value="carrier">Carrier</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {renderAdminAccessFields("add")}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="add-company">Company Name</Label>
                <Input 
                  id="add-company" 
                  value={formData.company}
                  onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                  data-testid="input-add-company"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-status">Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData(prev => ({ ...prev, status: v as "active" | "suspended" | "pending" }))}>
                  <SelectTrigger data-testid="select-add-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)} data-testid="button-cancel-add" className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button onClick={handleCreateUser} disabled={isSavingUser} data-testid="button-save-user" className="w-full sm:w-auto">
              {isSavingUser ? "Creating…" : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditModalOpen} onOpenChange={(open) => { if (!open) { setIsEditModalOpen(false); setSelectedUser(null); } }}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user details. Changes sync immediately.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Full Name</Label>
                <Input 
                  id="edit-name" 
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  data-testid="input-edit-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input 
                  id="edit-email" 
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  data-testid="input-edit-email"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Phone</Label>
                <Input 
                  id="edit-phone" 
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  data-testid="input-edit-phone"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-role">Role</Label>
                <Select value={formData.role} onValueChange={(v) => {
                  const role = v as "shipper" | "carrier" | "admin";
                  setFormData(prev => ({ ...prev, role }));
                  if (role !== "admin") {
                    setAdminAccessType("full");
                    setSelectedAdminRoleId("");
                  }
                }}>
                  <SelectTrigger data-testid="select-edit-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="shipper">Shipper</SelectItem>
                    <SelectItem value="carrier">Carrier</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {renderAdminAccessFields("edit")}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-company">Company Name</Label>
                <Input 
                  id="edit-company" 
                  value={formData.company}
                  onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                  data-testid="input-edit-company"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-status">Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData(prev => ({ ...prev, status: v as "active" | "inactive" | "suspended" | "pending" }))}>
                  <SelectTrigger data-testid="select-edit-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => { setIsEditModalOpen(false); setSelectedUser(null); }} data-testid="button-cancel-edit" className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button onClick={handleUpdateUser} disabled={isSavingUser} data-testid="button-update-user" className="w-full sm:w-auto">
              {isSavingUser ? "Saving…" : "Update User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteModalOpen} onOpenChange={(open) => { if (!open) { setIsDeleteModalOpen(false); setSelectedUser(null); } }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedUser?.name}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => { setIsDeleteModalOpen(false); setSelectedUser(null); }} data-testid="button-cancel-delete" className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteUser} data-testid="button-confirm-delete" className="w-full sm:w-auto">
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Details Modal */}
      <Dialog open={isDetailsModalOpen} onOpenChange={(open) => { if (!open) { setIsDetailsModalOpen(false); setSelectedUser(null); } }}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              User Details
            </DialogTitle>
            <DialogDescription>
              View user information
            </DialogDescription>
          </DialogHeader>
          
          {selectedUser && (
            <div className="space-y-6">
              {/* User Header */}
              <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg">
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <Users className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-semibold truncate">{selectedUser.name}</h3>
                  <p className="text-sm text-muted-foreground truncate">{selectedUser.email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {selectedUser.displayUserId && (
                      <span className="text-xs font-mono font-semibold text-primary">
                        {selectedUser.displayUserId}
                      </span>
                    )}
                    {selectedUser.isVerified && (
                      <Shield className="h-4 w-4 text-primary" />
                    )}
                  </div>
                </div>
              </div>

              {/* User Information Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Role</p>
                  <div className="flex items-center gap-2">
                    <p className="font-medium capitalize">{selectedUser.role}</p>
                    {getSubTypeBadge(selectedUser)}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  {getStatusBadge(selectedUser.status)}
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Company</p>
                  <p className="font-medium truncate">{selectedUser.company || "N/A"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Phone</p>
                  <p className="font-medium">{selectedUser.phone || "N/A"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Region</p>
                  <p className="font-medium">{selectedUser.region || "N/A"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Joined Date</p>
                  <p className="font-medium">{format(selectedUser.dateJoined, "MMM d, yyyy")}</p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={() => { setIsDetailsModalOpen(false); setSelectedUser(null); }} 
              className="w-full sm:w-auto"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Profile Dialog */}
      <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>User Profile</DialogTitle>
            <DialogDescription>
              User details and quick actions
            </DialogDescription>
          </DialogHeader>
          {profileUser && (
            <div>
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <Users className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base sm:text-lg font-semibold truncate">{profileUser.name}</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">{profileUser.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Role</p>
                  <p className="font-medium capitalize text-sm sm:text-base">{profileUser.role}</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Status</p>
                  {getStatusBadge(profileUser.status)}
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Company</p>
                  <p className="font-medium text-sm sm:text-base truncate">{profileUser.company || "N/A"}</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium text-sm sm:text-base">{profileUser.phone || "N/A"}</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Joined</p>
                  <p className="font-medium text-sm sm:text-base">{format(profileUser.dateJoined, "MMM d, yyyy")}</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Verified</p>
                  <p className="font-medium text-sm sm:text-base">{profileUser.isVerified ? "Yes" : "No"}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsProfileOpen(false)} data-testid="button-close-profile" className="w-full sm:w-auto">
              Close
            </Button>
            {profileUser && (
              <Button 
                onClick={() => {
                  setIsProfileOpen(false);
                  const user = users.find(u => u.userId === profileUser.userId);
                  if (user) {
                    openEditModal(user);
                  }
                }}
                data-testid="button-edit-from-profile"
                className="w-full sm:w-auto"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit User
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
