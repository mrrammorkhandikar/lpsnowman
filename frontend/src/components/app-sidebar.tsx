import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  Package,
  Truck,
  MessageSquare,
  MapPin,
  FileText,
  Users,
  BarChart3,
  Settings,
  Plus,
  Route,
  Gavel,
  Shield,
  Radio,
  DollarSign,
  User,
  History,
  ClipboardList,
  Key,
  UserCheck,
  CheckCircle,
  ChevronDown,
  ShieldCheck,
  Landmark,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAuth } from "@/lib/auth-context";
import { useAdminAccess } from "@/hooks/use-admin-access";
import { FLEET_PAGE_KEYS } from "@/shared/admin-pages";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  titleKey: string;
  url: string;
  icon: LucideIcon;
  pageKey?: string;
}

interface NavSection {
  titleKey: string;
  icon: LucideIcon;
  items: NavItem[];
  pageKeys?: string[];
}

const shipperItems: NavItem[] = [
  { titleKey: "nav.dashboard", url: "/shipper", icon: LayoutDashboard },
  { titleKey: "nav.postLoad", url: "/shipper/post-load", icon: Plus },
  { titleKey: "nav.myLoads", url: "/shipper/loads", icon: Package },
  { titleKey: "nav.memos", url: "/shipper/invoices", icon: FileText },
  { titleKey: "nav.tracking", url: "/shipper/tracking", icon: Route },
  { titleKey: "nav.deliveredLoads", url: "/shipper/delivered", icon: CheckCircle },
  { titleKey: "nav.documents", url: "/shipper/documents", icon: FileText },
];

const carrierItems: NavItem[] = [
  { titleKey: "nav.dashboard", url: "/carrier", icon: LayoutDashboard },
  { titleKey: "fleet.addTruck", url: "/carrier/add-truck", icon: Plus },
  { titleKey: "nav.myFleet", url: "/carrier/fleet", icon: Truck },
  { titleKey: "nav.myDrivers", url: "/carrier/drivers", icon: User },
  { titleKey: "nav.myOrders", url: "/carrier/my-orders", icon: ClipboardList },
  { titleKey: "nav.availableLoads", url: "/carrier/loads", icon: Route },
  { titleKey: "nav.myBids", url: "/carrier/bids", icon: Gavel },
  { titleKey: "nav.myShipments", url: "/carrier/shipments", icon: Package },
  { titleKey: "nav.activeTrips", url: "/carrier/trips", icon: MapPin },
  { titleKey: "nav.tripHistory", url: "/carrier/history", icon: History },
  { titleKey: "nav.revenue", url: "/carrier/revenue", icon: DollarSign },
  { titleKey: "nav.documents", url: "/carrier/my-documents", icon: FileText },
];

const soloItems: NavItem[] = [
  { titleKey: "nav.dashboard", url: "/carrier", icon: LayoutDashboard },
  { titleKey: "nav.myTruck", url: "/carrier/my-truck", icon: Truck },
  { titleKey: "nav.myInfo", url: "/carrier/my-info", icon: User },
  { titleKey: "nav.myOrders", url: "/carrier/my-orders", icon: ClipboardList },
  { titleKey: "nav.availableLoads", url: "/carrier/loads", icon: Route },
  { titleKey: "nav.myBids", url: "/carrier/bids", icon: Gavel },
  { titleKey: "nav.myShipments", url: "/carrier/shipments", icon: Package },
  { titleKey: "nav.activeTrips", url: "/carrier/trips", icon: MapPin },
  { titleKey: "nav.tripHistory", url: "/carrier/history", icon: History },
  { titleKey: "nav.revenue", url: "/carrier/revenue", icon: DollarSign },
  { titleKey: "nav.myDocuments", url: "/carrier/my-documents", icon: FileText },
];

const driverItems: NavItem[] = [
  { titleKey: "nav.myProfile", url: "/driver/profile", icon: User },
  { titleKey: "nav.myOrders", url: "/driver/my-orders", icon: ClipboardList },
  { titleKey: "nav.shipments", url: "/driver/shipments", icon: Package },
  { titleKey: "nav.activeTrips", url: "/driver/trips", icon: MapPin },
  { titleKey: "nav.documents", url: "/driver/documents", icon: FileText },
];

const adminItems: (NavItem | NavSection)[] = [
  { titleKey: "nav.overview", url: "/admin", icon: LayoutDashboard, pageKey: "overview" },
  { titleKey: "nav.postLoad", url: "/admin/post-load", icon: Plus, pageKey: "post_load" },
  { titleKey: "nav.loadQueue", url: "/admin/queue", icon: ClipboardList, pageKey: "load_queue" },
  { titleKey: "nav.bidsNegotiations", url: "/admin/negotiations", icon: Gavel, pageKey: "negotiations" },
  { titleKey: "nav.otpVerification", url: "/admin/otp-queue", icon: Key, pageKey: "otp_verification" },
  { titleKey: "nav.liveTracking", url: "/admin/live-tracking", icon: Radio, pageKey: "live_tracking" },
  { titleKey: "nav.shipperOnboarding", url: "/admin/onboarding", icon: UserCheck, pageKey: "shipper_onboarding" },
  { titleKey: "nav.memos", url: "/admin/invoices", icon: FileText, pageKey: "invoices" },
  { titleKey: "nav.users", url: "/admin/users", icon: Users, pageKey: "users" },
  { titleKey: "nav.adminRoles", url: "/admin/roles", icon: ShieldCheck, pageKey: "admin_roles" },
  {
    titleKey: "nav.fleet",
    icon: Truck,
    pageKeys: [...FLEET_PAGE_KEYS],
    items: [
      { titleKey: "nav.addTruck", url: "/admin/fleet/add-truck", icon: Plus, pageKey: "fleet_add_truck" },
      { titleKey: "nav.myFleet", url: "/admin/fleet", icon: Truck, pageKey: "fleet" },
      { titleKey: "nav.myCarriers", url: "/admin/drivers", icon: Users, pageKey: "drivers" },
    ],
  },
  { titleKey: "nav.allLoads", url: "/admin/loads", icon: Package, pageKey: "loads" },
  { titleKey: "nav.carriers", url: "/admin/carriers", icon: Truck, pageKey: "carriers" },
  { titleKey: "nav.verification", url: "/admin/verification", icon: Shield, pageKey: "carrier_verification" },
  { titleKey: "nav.documentReview", url: "/admin/finance-review", icon: FileText, pageKey: "document_review" },
  { titleKey: "nav.bc365Sync", url: "/admin/bc365-sync", icon: Landmark, pageKey: "bc365_sync" },
  { titleKey: "nav.reports", url: "/admin/reports", icon: BarChart3, pageKey: "reports" },
];

function filterAdminNavItems(
  items: (NavItem | NavSection)[],
  hasPage: (key: string) => boolean,
): (NavItem | NavSection)[] {
  const result: (NavItem | NavSection)[] = [];
  for (const item of items) {
    if ("items" in item) {
      const subItems = item.items.filter((sub) => !sub.pageKey || hasPage(sub.pageKey));
      const sectionAllowed =
        subItems.length > 0 ||
        (item.pageKeys?.some((key) => hasPage(key)) ?? false);
      if (sectionAllowed && subItems.length > 0) {
        result.push({ ...item, items: subItems });
      }
    } else if (!item.pageKey || hasPage(item.pageKey)) {
      result.push(item);
    }
  }
  return result;
}

export function AppSidebar() {
  const [location] = useLocation();
  const { user, carrierType } = useAuth();
  const { hasPage } = useAdminAccess();
  const { t } = useTranslation();

  // Detect solo carrier from carrierType
  const isSoloCarrier = user?.role === "carrier" && carrierType === "solo";

  // Fetch shipper onboarding data to determine if they are a transporter
  const { data: onboardingData } = useQuery<any>({
    queryKey: ["/api/shipper/onboarding"],
    enabled: user?.role === "shipper",
  });
  const isTransporter = user?.role === "shipper" && onboardingData?.shipperRole === "transporter";

  const getNavItems = () => {
    switch (user?.role) {
      case "shipper":
        return shipperItems;
      case "driver":
        return driverItems;
      case "carrier":
        return isSoloCarrier ? soloItems : carrierItems;
      case "admin":
        return filterAdminNavItems(adminItems, hasPage);
      default:
        return shipperItems;
    }
  };

  const getRoleLabel = () => {
    switch (user?.role) {
      case "shipper":
        return isTransporter ? "Transporter Portal" : t("roles.shipperPortal");
      case "driver":
        return "Driver Portal";
      case "carrier":
        return isSoloCarrier ? t("roles.soloDriver") : t("roles.carrierPortal");
      case "admin":
        return user?.adminRoleName
          ? `${t("roles.adminConsole")} · ${user.adminRoleName}`
          : t("roles.adminConsole");
      default:
        return "Portal";
    }
  };

  const getRoleBadgeVariant = () => {
    switch (user?.role) {
      case "admin":
        return "destructive";
      case "driver":
        return "default";
      case "carrier":
        return "secondary";
      default:
        return "default";
    }
  };

  const items = getNavItems();

  return (
    <Sidebar>
      <SidebarHeader className="p-4 sm:p-6 border-b border-sidebar-border flex-shrink-0">
        <div className="flex flex-col gap-3">
          <img 
            src="/assets/Purple_and_Black_Modern_Software_Developer_LinkedIn_Banner_1770118882647.png" 
            alt="Load Smart" 
            className="w-full h-auto object-contain"
            data-testid="text-app-name"
          />
          <Badge variant={getRoleBadgeVariant()} className="w-fit text-xs">
            {getRoleLabel()}
          </Badge>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("sections.navigation")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                // Check if it's a section with sub-items
                if ("items" in item) {
                  const isActive = item.items.some(subItem => 
                    location === subItem.url || 
                    (subItem.url !== "/" && location.startsWith(subItem.url))
                  );
                  const title = t(item.titleKey);
                  return (
                    <Collapsible key={item.titleKey} defaultOpen={isActive} className="group/collapsible">
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton className="flex items-center gap-2">
                            <item.icon className="h-4 w-4" />
                            <span>{title}</span>
                            <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {item.items.map((subItem) => {
                              const isSubActive = location === subItem.url;
                              const subTitle = t(subItem.titleKey);
                              return (
                                <SidebarMenuSubItem key={subItem.titleKey}>
                                  <SidebarMenuSubButton asChild data-active={isSubActive}>
                                    <Link href={subItem.url} data-testid={`link-nav-${subItem.titleKey.replace(/\./g, "-")}`}>
                                      <subItem.icon className="h-4 w-4" />
                                      <span>{subTitle}</span>
                                    </Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              );
                            })}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  );
                }
                
                // Regular nav item
                const isActive = location === item.url || 
                  (item.url !== "/" && location.startsWith(item.url) && item.url.split("/").length > 2);
                const title = t(item.titleKey);
                return (
                  <SidebarMenuItem key={item.titleKey}>
                    <SidebarMenuButton asChild data-active={isActive}>
                      <Link href={item.url} data-testid={`link-nav-${item.titleKey.replace(/\./g, "-")}`}>
                        <item.icon className="h-4 w-4" />
                        <span>{title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>{t("common.settings")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild data-active={location === "/settings"}>
                  <Link href="/settings" data-testid="link-nav-settings">
                    <Settings className="h-4 w-4" />
                    <span>{t("common.settings")}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 border-t border-sidebar-border flex-shrink-0">
        {user && (
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarFallback className="bg-primary/10 text-primary">
                {user.username?.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-sm font-medium truncate" data-testid="text-username">
                {user.username}
              </span>
              <span className="text-xs text-muted-foreground truncate">
                {user.companyName || user.email}
              </span>
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
