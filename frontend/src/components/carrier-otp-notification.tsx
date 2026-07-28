import { useEffect, useState } from "react";
import { Shield, Clock, Copy, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { onMarketplaceEvent } from "@/lib/marketplace-socket";
import { useToast } from "@/hooks/use-toast";

interface OtpNotification {
  otpCode: string;
  type: "trip_start" | "trip_end";
  expiresAt: string;
  validityMinutes: number;
  shipmentId: string;
}

export function CarrierOtpNotification() {
  const [otpData, setOtpData] = useState<OtpNotification | null>(null);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const auth = useAuth();
  const { toast } = useToast();
  
  const user = auth?.user;

  useEffect(() => {
    if (!user || user.role !== "carrier") return;

    const unsubscribe = onMarketplaceEvent("otp_approved", (data) => {
      if (data.carrierId === user.id && data.otpCode) {
        setOtpData({
          otpCode: data.otpCode,
          type: data.type,
          expiresAt: data.expiresAt,
          validityMinutes: data.validityMinutes || 10,
          shipmentId: data.shipmentId,
        });
        
        toast({
          title: "OTP Received",
          description: `Your ${data.type === "trip_start" ? "trip start" : "trip end"} OTP has arrived!`,
        });
      }
    });

    return unsubscribe;
  }, [user, toast]);

  useEffect(() => {
    if (!otpData) return;

    const updateTimer = () => {
      const expires = new Date(otpData.expiresAt).getTime();
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((expires - now) / 1000));
      setTimeLeft(remaining);

      if (remaining <= 0) {
        setOtpData(null);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [otpData]);

  const handleCopy = async () => {
    if (!otpData) return;
    
    try {
      await navigator.clipboard.writeText(otpData.otpCode);
      setCopied(true);
      toast({ title: "Copied!", description: "OTP copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Copy failed", description: "Please copy manually", variant: "destructive" });
    }
  };

  const handleDismiss = () => {
    setOtpData(null);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (!otpData) return null;

  const isUrgent = timeLeft < 120;

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <Card className="w-80 shadow-lg border-2 border-primary/20 bg-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-primary/10">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-base">
                {otpData.type === "trip_start" ? "Trip Start" : "Trip End"} OTP
              </CardTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDismiss}
              className="h-8 w-8"
              data-testid="button-dismiss-otp"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">Your verification code:</p>
            <div className="flex items-center justify-center gap-3">
              <div 
                className="text-3xl font-mono font-bold tracking-[0.3em] bg-muted px-4 py-2 rounded-md"
                data-testid="text-otp-code"
              >
                {otpData.otpCode}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                data-testid="button-copy-otp"
              >
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2">
            <Clock className={`h-4 w-4 ${isUrgent ? "text-destructive" : "text-muted-foreground"}`} />
            <Badge variant={isUrgent ? "destructive" : "secondary"}>
              Expires in {formatTime(timeLeft)}
            </Badge>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Enter this code in the trip verification screen to{" "}
            {otpData.type === "trip_start" ? "start your trip" : "complete delivery"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
