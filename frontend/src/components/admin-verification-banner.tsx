import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";

export function AdminVerificationBanner() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const [isDismissed, setIsDismissed] = useState(false);

  // Reset dismissed state when navigating to a new page
  useEffect(() => {
    setIsDismissed(false);
  }, [location]);

  // Fetch pending carrier verifications count
  const { data: verifications } = useQuery<any[]>({
    queryKey: ['/api/admin/verifications'],
    enabled: user?.role === 'admin',
  });

  // Only show for admin users
  if (user?.role !== 'admin') {
    return null;
  }

  // Don't show if already on verification page
  if (location === '/admin/verification') {
    return null;
  }

  // Don't show if dismissed
  if (isDismissed) {
    return null;
  }

  // Count pending verifications
  const pendingCount = verifications?.filter(v => v.status === 'pending')?.length || 0;

  // Don't show if no pending verifications
  if (pendingCount === 0) {
    return null;
  }

  return (
    <div 
      className="mx-4 mt-4 mb-0 flex items-center justify-between gap-4 rounded-lg border border-orange-500/50 bg-orange-500/10 px-4 py-3"
      data-testid="banner-pending-verification"
    >
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 text-orange-500 flex-shrink-0" />
        <span className="text-sm font-medium">
          {pendingCount} carrier{pendingCount !== 1 ? 's' : ''} awaiting verification
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setLocation('/admin/verification')}
          data-testid="button-view-pending"
        >
          View Pending
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setIsDismissed(true)}
          data-testid="button-dismiss-banner"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
