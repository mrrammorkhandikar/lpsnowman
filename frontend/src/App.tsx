import { Suspense, lazy, useState, useEffect, useCallback } from "react";
import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme-provider";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { NotificationPanel } from "@/components/notification-panel";
import { GlobalSearch } from "@/components/global-search";
//import { HelpBotWidget } from "@/components/HelpBotWidget";
import { MockDataProvider } from "@/lib/mock-data-store";
import { DocumentVaultProvider } from "@/lib/document-vault-store";
import { AdminDataProvider } from "@/lib/admin-data-store";
import { CarrierDataProvider } from "@/lib/carrier-data-store";
import { CarrierOtpNotification } from "@/components/carrier-otp-notification";
import { CarrierOnboardingGate } from "@/hooks/use-carrier-onboarding-gate";
import { ShipperOnboardingGate } from "@/hooks/use-shipper-onboarding-gate";
import { AdminVerificationBanner } from "@/components/admin-verification-banner";
import { AdminAccessGate } from "@/components/admin-access-gate";
import { trackPageView } from "@/lib/analytics";

import AuthPage from "@/pages/auth";
const NotFound = lazy(() => import("@/pages/not-found"));
const SettingsPage = lazy(() => import("@/pages/settings"));
const LandingPage = lazy(() => import("@/pages/landing"));
const LoadBoardPage = lazy(() => import("@/pages/load-board"));
const ContactPage = lazy(() => import("@/pages/contact"));
const ForDriversPage = lazy(() => import("@/pages/solutions/for-drivers"));
const ForCarriersPage = lazy(() => import("@/pages/solutions/for-carriers"));
const ForShippersPage = lazy(() => import("@/pages/solutions/for-shippers"));
const FAQsPage = lazy(() => import("@/pages/faqs"));
const PressRoomPage = lazy(() => import("@/pages/press-room"));
const AboutPage = lazy(() => import("@/pages/about"));
const TermsOfServicePage = lazy(() => import("@/pages/terms-of-service"));
const PrivacyPolicyPage = lazy(() => import("@/pages/privacy-policy"));

const ShipperDashboard = lazy(() => import("@/pages/shipper").then(m => ({ default: m.ShipperDashboard })));
const PostLoadPage = lazy(() => import("@/pages/shipper").then(m => ({ default: m.PostLoadPage })));
const ShipperLoadsPage = lazy(() => import("@/pages/shipper").then(m => ({ default: m.ShipperLoadsPage })));
const LoadDetailPage = lazy(() => import("@/pages/shipper").then(m => ({ default: m.LoadDetailPage })));
const TrackingPage = lazy(() => import("@/pages/shipper").then(m => ({ default: m.TrackingPage })));
const DeliveredLoadsPage = lazy(() => import("@/pages/shipper").then(m => ({ default: m.DeliveredLoadsPage })));
const ShipperDocumentsPage = lazy(() => import("@/pages/shipper").then(m => ({ default: m.ShipperDocumentsPage })));
const ShipperInvoicesPage = lazy(() => import("@/pages/shipper").then(m => ({ default: m.ShipperInvoicesPage })));
const ShipperOnboardingPage = lazy(() => import("@/pages/shipper").then(m => ({ default: m.ShipperOnboardingPage })));

const CarrierDashboard = lazy(() => import("@/pages/carrier").then(m => ({ default: m.CarrierDashboard })));
const AddTruckPage = lazy(() => import("@/pages/carrier").then(m => ({ default: m.AddTruckPage })));
const FleetPage = lazy(() => import("@/pages/carrier").then(m => ({ default: m.FleetPage })));
const CarrierLoadsPage = lazy(() => import("@/pages/carrier").then(m => ({ default: m.CarrierLoadsPage })));
const CarrierBidsPage = lazy(() => import("@/pages/carrier").then(m => ({ default: m.CarrierBidsPage })));
const TripsPage = lazy(() => import("@/pages/carrier").then(m => ({ default: m.TripsPage })));
const CarrierDocumentsPage = lazy(() => import("@/pages/carrier").then(m => ({ default: m.CarrierDocumentsPage })));
const CarrierRevenuePage = lazy(() => import("@/pages/carrier").then(m => ({ default: m.CarrierRevenuePage })));
const CarrierDriversPage = lazy(() => import("@/pages/carrier").then(m => ({ default: m.CarrierDriversPage })));
const CarrierHistoryPage = lazy(() => import("@/pages/carrier").then(m => ({ default: m.CarrierHistoryPage })));
const CarrierShipmentsPage = lazy(() => import("@/pages/carrier").then(m => ({ default: m.CarrierShipmentsPage })));
const MyTruckPage = lazy(() => import("@/pages/carrier").then(m => ({ default: m.MyTruckPage })));
const MyInfoPage = lazy(() => import("@/pages/carrier").then(m => ({ default: m.MyInfoPage })));
const MyDocumentsPage = lazy(() => import("@/pages/carrier").then(m => ({ default: m.MyDocumentsPage })));
const CarrierOnboardingPage = lazy(() => import("@/pages/carrier").then(m => ({ default: m.CarrierOnboardingPage })));
const CarrierMyOrdersPage = lazy(() => import("@/pages/carrier").then(m => ({ default: m.CarrierMyOrdersPage })));

const SoloLoadFeed = lazy(() => import("@/pages/solo").then(m => ({ default: m.SoloLoadFeed })));
const SoloMyBids = lazy(() => import("@/pages/solo").then(m => ({ default: m.SoloMyBids })));
const SoloMyTrips = lazy(() => import("@/pages/solo").then(m => ({ default: m.SoloMyTrips })));
const SoloEarnings = lazy(() => import("@/pages/solo").then(m => ({ default: m.SoloEarnings })));

const DriverDashboard = lazy(() => import("@/pages/driver").then(m => ({ default: m.DriverDashboard })));
const DriverTripsPage = lazy(() => import("@/pages/driver").then(m => ({ default: m.DriverTripsPage })));
const DriverEarningsPage = lazy(() => import("@/pages/driver").then(m => ({ default: m.DriverEarningsPage })));
const DriverDocumentsPage = lazy(() => import("@/pages/driver").then(m => ({ default: m.DriverDocumentsPage })));
const DriverProfilePage = lazy(() => import("@/pages/driver").then(m => ({ default: m.DriverProfilePage })));
const DriverMyOrdersPage = lazy(() => import("@/pages/driver/my-orders"));
const DriverShipmentsPage = lazy(() => import("@/pages/driver/shipments"));

const AdminOverview = lazy(() => import("@/pages/admin").then(m => ({ default: m.AdminOverview })));
const AdminUsersPage = lazy(() => import("@/pages/admin").then(m => ({ default: m.AdminUsersPage })));
const AdminLoadsPage = lazy(() => import("@/pages/admin").then(m => ({ default: m.AdminLoadsPage })));
const AdminLoadDetailsPage = lazy(() => import("@/pages/admin").then(m => ({ default: m.AdminLoadDetailsPage })));
const AdminCarriersPage = lazy(() => import("@/pages/admin").then(m => ({ default: m.AdminCarriersPage })));
const CarrierProfilePage = lazy(() => import("@/pages/admin").then(m => ({ default: m.CarrierProfilePage })));
const AdminVolumeAnalytics = lazy(() => import("@/pages/admin").then(m => ({ default: m.AdminVolumeAnalytics })));
const RevenueDashboard = lazy(() => import("@/pages/admin").then(m => ({ default: m.RevenueDashboard })));
const AdminLoadQueuePage = lazy(() => import("@/pages/admin").then(m => ({ default: m.AdminLoadQueuePage })));
const AdminNegotiationsPage = lazy(() => import("@/pages/admin").then(m => ({ default: m.AdminNegotiationsPage })));
const AdminInvoicesPage = lazy(() => import("@/pages/admin").then(m => ({ default: m.AdminInvoicesPage })));
const AdminCarrierVerificationPage = lazy(() => import("@/pages/admin").then(m => ({ default: m.AdminCarrierVerificationPage })));
const AdminOnboardingPage = lazy(() => import("@/pages/admin").then(m => ({ default: m.AdminOnboardingPage })));
const AdminLiveTrackingPage = lazy(() => import("@/pages/admin").then(m => ({ default: m.AdminLiveTrackingPage })));
const NegotiationInbox = lazy(() => import("@/pages/admin").then(m => ({ default: m.NegotiationInbox })));
const AdminOtpQueuePage = lazy(() => import("@/pages/admin").then(m => ({ default: m.AdminOtpQueuePage })));
const AdminNearbyTrucksPage = lazy(() => import("@/pages/admin").then(m => ({ default: m.AdminNearbyTrucksPage })));
const AdminPostLoadPage = lazy(() => import("@/pages/admin").then(m => ({ default: m.AdminPostLoadPage })));
const AdminAddTruckPage = lazy(() => import("@/pages/admin").then(m => ({ default: m.AdminAddTruckPage })));
const AdminFleetPage = lazy(() => import("@/pages/admin").then(m => ({ default: m.AdminFleetPage })));
const AdminDriversPage = lazy(() => import("@/pages/admin").then(m => ({ default: m.AdminDriversPage })));
const MyCarrierProfilePage = lazy(() => import("@/pages/admin").then(m => ({ default: m.MyCarrierProfilePage })));

const FinanceDashboard = lazy(() => import("@/pages/finance/dashboard"));

function PageLoader() {
  return (
    <div className="flex h-full items-center justify-center min-h-[200px] bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-muted-foreground text-sm">Loading page...</p>
      </div>
    </div>
  );
}

function withShipperGate<P extends object>(Component: React.ComponentType<P>) {
  function Wrapped(props: P) {
    return <ShipperOnboardingGate><Component {...props} /></ShipperOnboardingGate>;
  }
  Wrapped.displayName = `withShipperGate(${Component.displayName ?? Component.name})`;
  return Wrapped;
}

function withCarrierGate<P extends object>(Component: React.ComponentType<P>) {
  function Wrapped(props: P) {
    return <CarrierOnboardingGate><Component {...props} /></CarrierOnboardingGate>;
  }
  Wrapped.displayName = `withCarrierGate(${Component.displayName ?? Component.name})`;
  return Wrapped;
}

function withRoleGate<P extends object>(allowedRole: string, redirectTo: string) {
  return (Component: React.ComponentType<P>) => {
    function Wrapped(props: P) {
      const { user } = useAuth();
      if (!user || user.role !== allowedRole) {
        return <Redirect to={redirectTo} />;
      }
      return <Component {...props} />;
    }
    Wrapped.displayName = `withRoleGate(${Component.displayName ?? Component.name})`;
    return Wrapped;
  };
}

const ShipperDashboardRoute = withShipperGate(ShipperDashboard as React.ComponentType);
const PostLoadRoute = withShipperGate(PostLoadPage as React.ComponentType);
const ShipperLoadsRoute = withShipperGate(ShipperLoadsPage as React.ComponentType);
const LoadDetailRoute = withShipperGate(LoadDetailPage as React.ComponentType);
const TrackingRoute = withShipperGate(TrackingPage as React.ComponentType);
const DeliveredLoadsRoute = withShipperGate(DeliveredLoadsPage as React.ComponentType);
const ShipperDocumentsRoute = withShipperGate(ShipperDocumentsPage as React.ComponentType);
const ShipperInvoicesRoute = withShipperGate(ShipperInvoicesPage as React.ComponentType);

const CarrierDashboardRoute = withCarrierGate(CarrierDashboard as React.ComponentType);
const AddTruckRoute = withCarrierGate(AddTruckPage as React.ComponentType);
const FleetRoute = withCarrierGate(FleetPage as React.ComponentType);
const CarrierLoadsRoute = withCarrierGate(CarrierLoadsPage as React.ComponentType);
const CarrierBidsRoute = withCarrierGate(CarrierBidsPage as React.ComponentType);
const TripsRoute = withCarrierGate(TripsPage as React.ComponentType);
const CarrierDocumentsRoute = withCarrierGate(CarrierDocumentsPage as React.ComponentType);
const CarrierRevenueRoute = withCarrierGate(CarrierRevenuePage as React.ComponentType);
const CarrierDriversRoute = withCarrierGate(CarrierDriversPage as React.ComponentType);
const CarrierHistoryRoute = withCarrierGate(CarrierHistoryPage as React.ComponentType);
const CarrierShipmentsRoute = withCarrierGate(CarrierShipmentsPage as React.ComponentType);
const MyTruckRoute = withCarrierGate(MyTruckPage as React.ComponentType);
const MyInfoRoute = withCarrierGate(MyInfoPage as React.ComponentType);
const MyDocumentsRoute = withCarrierGate(MyDocumentsPage as React.ComponentType);
const CarrierMyOrdersRoute = withCarrierGate(CarrierMyOrdersPage as React.ComponentType);

const SoloLoadFeedRoute = withCarrierGate(SoloLoadFeed as React.ComponentType);
const SoloMyBidsRoute = withCarrierGate(SoloMyBids as React.ComponentType);
const SoloMyTripsRoute = withCarrierGate(SoloMyTrips as React.ComponentType);
const SoloEarningsRoute = withCarrierGate(SoloEarnings as React.ComponentType);

const DriverDashboardRoute = withRoleGate("driver", "/auth")(DriverDashboard as React.ComponentType);
const DriverTripsRoute = withRoleGate("driver", "/auth")(DriverTripsPage as React.ComponentType);
const DriverEarningsRoute = withRoleGate("driver", "/auth")(DriverEarningsPage as React.ComponentType);
const DriverDocumentsRoute = withRoleGate("driver", "/auth")(DriverDocumentsPage as React.ComponentType);
const DriverProfileRoute = withRoleGate("driver", "/auth")(DriverProfilePage as React.ComponentType);
const DriverMyOrdersRoute = withRoleGate("driver", "/auth")(DriverMyOrdersPage as React.ComponentType);
const DriverShipmentsRoute = withRoleGate("driver", "/auth")(DriverShipmentsPage as React.ComponentType);

const AdminFleetRoute = withRoleGate("admin", "/auth")(AdminFleetPage as React.ComponentType);
const AdminAddTruckRoute = withRoleGate("admin", "/auth")(AdminAddTruckPage as React.ComponentType);
const AdminDriversRoute = withRoleGate("admin", "/auth")(AdminDriversPage as React.ComponentType);
const AdminDriverProfileRoute = withRoleGate("admin", "/auth")(MyCarrierProfilePage as React.ComponentType);
const AdminRolesPage = lazy(() => import("@/pages/admin/roles"));
const AdminBc365SyncPage = lazy(() => import("@/pages/admin/bc365-sync"));

const PUBLIC_ROUTES: Record<string, React.ComponentType> = {
  "/load-board": LoadBoardPage as React.ComponentType,
  "/contact": ContactPage as React.ComponentType,
  "/solutions/drivers": ForDriversPage as React.ComponentType,
  "/solutions/carriers": ForCarriersPage as React.ComponentType,
  "/solutions/shippers": ForShippersPage as React.ComponentType,
  "/faqs": FAQsPage as React.ComponentType,
  "/press-room": PressRoomPage as React.ComponentType,
  "/about": AboutPage as React.ComponentType,
  "/terms-of-service": TermsOfServicePage as React.ComponentType,
  "/privacy-policy": PrivacyPolicyPage as React.ComponentType,
};

function RootRedirect() {
  const { user } = useAuth();
  const to = user?.role === "admin" ? "/admin" : user?.role === "driver" ? "/driver" : user?.role === "carrier" ? "/carrier" : "/shipper";
  return <Redirect to={to} />;
}

const SIDEBAR_STYLE = {
  "--sidebar-width": "16rem",
  "--sidebar-width-icon": "4rem",
} as React.CSSProperties;

function AuthenticatedLayout() {
  return (
    <SidebarProvider style={SIDEBAR_STYLE}>
      <div className="flex w-full overflow-hidden" style={{ height: '100dvh' }}>
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden" style={{ height: '100dvh' }}>
          <header className="flex items-center justify-between gap-2 sm:gap-4 p-2 sm:p-3 border-b border-border sticky top-0 z-50 bg-background">
            <SidebarTrigger data-testid="button-sidebar-toggle" className="shrink-0" />
            <div className="flex-1 flex justify-center min-w-0 px-1 sm:px-2">
              <GlobalSearch />
            </div>
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              <NotificationPanel />
              <span className="hidden sm:inline-flex">
                <LanguageSwitcher />
              </span>
              <ThemeToggle />
            </div>
          </header>
          <AdminVerificationBanner />
          <main className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
            <Suspense fallback={<PageLoader />}>
              <AdminAccessGate>
              <Switch>
                <Route path="/" component={RootRedirect} />

                <Route path="/shipper" component={ShipperDashboardRoute} />
                <Route path="/shipper/post-load" component={PostLoadRoute} />
                <Route path="/shipper/loads" component={ShipperLoadsRoute} />
                <Route path="/shipper/loads/:id" component={LoadDetailRoute} />
                <Route path="/shipper/tracking" component={TrackingRoute} />
                <Route path="/shipper/delivered" component={DeliveredLoadsRoute} />
                <Route path="/shipper/documents" component={ShipperDocumentsRoute} />
                <Route path="/shipper/invoices" component={ShipperInvoicesRoute} />
                <Route path="/shipper/onboarding" component={ShipperOnboardingPage as React.ComponentType} />

                <Route path="/carrier" component={CarrierDashboardRoute} />
                <Route path="/carrier/add-truck" component={AddTruckRoute} />
                <Route path="/carrier/fleet" component={FleetRoute} />
                <Route path="/carrier/loads" component={CarrierLoadsRoute} />
                <Route path="/carrier/bids" component={CarrierBidsRoute} />
                <Route path="/carrier/trips" component={TripsRoute} />
                <Route path="/carrier/documents" component={CarrierDocumentsRoute} />
                <Route path="/carrier/revenue" component={CarrierRevenueRoute} />
                <Route path="/carrier/drivers" component={CarrierDriversRoute} />
                <Route path="/carrier/history" component={CarrierHistoryRoute} />
                <Route path="/carrier/shipments" component={CarrierShipmentsRoute} />
                <Route path="/carrier/my-truck" component={MyTruckRoute} />
                <Route path="/carrier/my-info" component={MyInfoRoute} />
                <Route path="/carrier/my-documents" component={MyDocumentsRoute} />
                <Route path="/carrier/my-orders" component={CarrierMyOrdersRoute} />
                <Route path="/carrier/onboarding" component={CarrierOnboardingPage as React.ComponentType} />

                <Route path="/solo" component={SoloLoadFeedRoute} />
                <Route path="/solo/loads" component={SoloLoadFeedRoute} />
                <Route path="/solo/bids" component={SoloMyBidsRoute} />
                <Route path="/solo/trips" component={SoloMyTripsRoute} />
                <Route path="/solo/earnings" component={SoloEarningsRoute} />

                <Route path="/driver" component={DriverMyOrdersRoute} />
                <Route path="/driver/my-orders" component={DriverMyOrdersRoute} />
                <Route path="/driver/shipments" component={DriverShipmentsRoute} />
                <Route path="/driver/trips" component={DriverTripsRoute} />
                <Route path="/driver/earnings" component={DriverEarningsRoute} />
                <Route path="/driver/documents" component={DriverDocumentsRoute} />
                <Route path="/driver/profile" component={DriverProfileRoute} />

                <Route path="/admin" component={AdminOverview as React.ComponentType} />
                <Route path="/admin/post-load" component={AdminPostLoadPage as React.ComponentType} />
                <Route path="/admin/queue" component={AdminLoadQueuePage as React.ComponentType} />
                <Route path="/admin/negotiations" component={AdminNegotiationsPage as React.ComponentType} />
                <Route path="/admin/inbox" component={NegotiationInbox as React.ComponentType} />
                <Route path="/admin/users" component={AdminUsersPage as React.ComponentType} />
                <Route path="/admin/users/:id" component={AdminUsersPage as React.ComponentType} />
                <Route path="/admin/loads" component={AdminLoadsPage as React.ComponentType} />
                <Route path="/admin/loads/:loadId" component={AdminLoadDetailsPage as React.ComponentType} />
                <Route path="/admin/carriers" component={AdminCarriersPage as React.ComponentType} />
                <Route path="/admin/carriers/:carrierId" component={CarrierProfilePage as React.ComponentType} />
                <Route path="/admin/volume" component={AdminVolumeAnalytics as React.ComponentType} />
                <Route path="/admin/analytics" component={AdminVolumeAnalytics as React.ComponentType} />
                <Route path="/admin/revenue" component={RevenueDashboard as React.ComponentType} />
                <Route path="/admin/revenue/:metric" component={RevenueDashboard as React.ComponentType} />
                <Route path="/admin/nearby-trucks" component={AdminNearbyTrucksPage as React.ComponentType} />
                <Route path="/admin/verification" component={AdminCarrierVerificationPage as React.ComponentType} />
                <Route path="/admin/onboarding" component={AdminOnboardingPage as React.ComponentType} />
                <Route path="/admin/reports" component={AdminVolumeAnalytics as React.ComponentType} />
                <Route path="/admin/invoices" component={AdminInvoicesPage as React.ComponentType} />
                <Route path="/admin/otp-queue" component={AdminOtpQueuePage as React.ComponentType} />
                <Route path="/admin/live-tracking" component={AdminLiveTrackingPage as React.ComponentType} />
                <Route path="/admin/finance-review" component={FinanceDashboard as React.ComponentType} />
                <Route path="/admin/fleet/add-truck" component={AdminAddTruckRoute} />
                <Route path="/admin/fleet" component={AdminFleetRoute} />
                <Route path="/admin/drivers/:driverId" component={AdminDriverProfileRoute} />
                <Route path="/admin/drivers" component={AdminDriversRoute} />
                <Route path="/admin/roles" component={AdminRolesPage as React.ComponentType} />
                <Route path="/admin/bc365-sync" component={AdminBc365SyncPage as React.ComponentType} />

                <Route path="/settings" component={SettingsPage as React.ComponentType} />

                <Route component={NotFound as React.ComponentType} />
              </Switch>
              </AdminAccessGate>
            </Suspense>
          </main>
        </div>
      </div>
      <CarrierOtpNotification />
    </SidebarProvider>
  );
}

function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.innerWidth < 768 ||
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  );
}

function AppContent() {
  const { user, isLoading, isLoggingOut } = useAuth();
  const [location] = useLocation();
  const [isMobile, setIsMobile] = useState<boolean>(isMobileDevice);

  const handleResize = useCallback(() => setIsMobile(isMobileDevice()), []);

  useEffect(() => {
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [handleResize]);

  // Add/remove public-page class on body for scroll override
  const isPublicPage = !user && (location === "/" || location === "/auth" || location in PUBLIC_ROUTES);
  useEffect(() => {
    if (isPublicPage) {
      document.body.classList.add("public-page");
    } else {
      document.body.classList.remove("public-page");
    }
    return () => document.body.classList.remove("public-page");
  }, [isPublicPage]);

  // Track page views on route change
  useEffect(() => {
    trackPageView(location);
  }, [location]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-6">
          <div className="text-2xl font-bold text-primary">LoadPilot</div>
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground text-sm">Starting up...</p>
        </div>
      </div>
    );
  }

  if (isLoggingOut) {
    return (
      <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm">
        <div className="text-2xl font-bold text-primary mb-6">LoadPilot</div>
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="mt-4 text-muted-foreground text-sm">Signing out...</p>
      </div>
    );
  }

  if (!user) {
    if (location === "/" && !isMobile) {
      return <Suspense fallback={<PageLoader />}><LandingPage /></Suspense>;
    }

    if (location === "/" && isMobile) {
      return <Redirect to="/auth" />;
    }

    if (location === "/auth") {
      return (
        <div className="h-[100dvh] w-full overflow-y-auto overflow-x-hidden overscroll-contain">
          <AuthPage />
        </div>
      );
    }

    const PublicPage = PUBLIC_ROUTES[location];
    if (PublicPage) {
      return <Suspense fallback={<PageLoader />}><PublicPage /></Suspense>;
    }

    return <Redirect to="/auth" />;
  }

  if (location === "/auth" || location === "/") {
    const defaultRoute =
      user.role === "admin" ? "/admin"
      : user.role === "driver" ? "/driver"
      : user.role === "carrier" ? "/carrier"
      : "/shipper";
    return <Redirect to={defaultRoute} />;
  }

  return <AuthenticatedLayout />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <MockDataProvider>
            <DocumentVaultProvider>
              <AdminDataProvider>
                <CarrierDataProvider>
                  <TooltipProvider>
                    <AppContent />
                    <Toaster />
                    {/* <HelpBotWidget /> */}
                  </TooltipProvider>
                </CarrierDataProvider>
              </AdminDataProvider>
            </DocumentVaultProvider>
          </MockDataProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
