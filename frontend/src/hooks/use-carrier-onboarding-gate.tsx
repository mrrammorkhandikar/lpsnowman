import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";

interface OnboardingStatus {
  id: string;
  status: string;
  carrierType?: string;
  rejectionReason?: string;
}

export function useCarrierOnboardingGate() {
  const { user } = useAuth();
  
  // Enable for carrier role (solo operators also have role="carrier")
  const isCarrierRole = user?.role === "carrier";
  
  const { data: onboardingStatus, isLoading } = useQuery<OnboardingStatus>({
    queryKey: ["/api/carrier/onboarding"],
    enabled: isCarrierRole,
  });

  const isVerified = user?.isVerified === true;
  const onboardingApproved = onboardingStatus?.status === "approved";
  const onboardingComplete = isVerified || onboardingApproved;
  
  // Block access for ALL non-approved carriers (including pending/under_review)
  // Only approved or verified carriers can access marketplace routes
  const needsOnboarding = isCarrierRole && !onboardingComplete;
  
  const pendingReview = onboardingStatus?.status === "pending" || onboardingStatus?.status === "under_review";

  return {
    isLoading: isCarrierRole && isLoading,
    needsOnboarding,
    pendingReview,
    onboardingStatus,
    onboardingComplete,
    isCarrierRole,
  };
}

export function CarrierOnboardingGate({ children }: { children: React.ReactNode }) {
  const { isLoading, needsOnboarding } = useCarrierOnboardingGate();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (needsOnboarding) {
    return <Redirect to="/carrier/onboarding" />;
  }

  return <>{children}</>;
}
