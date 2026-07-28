import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";

interface OnboardingStatus {
  id: string;
  status: string;
  rejectionReason?: string;
}

export function useShipperOnboardingGate() {
  const { user } = useAuth();
  
  const isShipperRole = user?.role === "shipper";
  
  const { data: onboardingStatus, isLoading } = useQuery<OnboardingStatus>({
    queryKey: ["/api/shipper/onboarding"],
    enabled: isShipperRole,
  });

  const isVerified = user?.isVerified === true;
  const onboardingApproved = onboardingStatus?.status === "approved";
  const onboardingComplete = isVerified || onboardingApproved;
  
  const needsOnboarding = isShipperRole && !onboardingComplete;
  
  const pendingReview = onboardingStatus?.status === "pending" || onboardingStatus?.status === "under_review";

  return {
    isLoading: isShipperRole && isLoading,
    needsOnboarding,
    pendingReview,
    onboardingStatus,
    onboardingComplete,
    isShipperRole,
  };
}

export function ShipperOnboardingGate({ children }: { children: React.ReactNode }) {
  const { isLoading, needsOnboarding } = useShipperOnboardingGate();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (needsOnboarding) {
    return <Redirect to="/shipper/onboarding" />;
  }

  return <>{children}</>;
}
