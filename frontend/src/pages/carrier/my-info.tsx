import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { 
  User, 
  Phone,
  Mail,
  Building2,
  Truck,
  Star,
  Award,
  CheckCircle,
  Clock,
  FileText,
  Edit2,
  Save,
  X,
  AlertTriangle
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

interface SoloProfile {
  user: {
    id: string;
    userNumber?: number;
    username: string;
    email: string;
    phone: string | null;
    companyName: string | null;
    avatar: string | null;
  };
  carrierProfile: {
    id: string;
    carrierType: string;
    rating: string;
    reliabilityScore: string;
    communicationScore: string;
    onTimeScore: string;
    totalDeliveries: number;
    badgeLevel: string;
    bio: string | null;
  } | null;
  truck: {
    id: string;
    licensePlate: string;
    truckType: string;
    capacity: number;
  } | null;
  driverDocuments: Array<{
    id: string;
    documentType: string;
    fileName: string;
    expiryDate: string | null;
    isVerified: boolean;
  }>;
  stats: {
    completedTrips: number;
    totalTrips: number;
    rating: string;
    reliabilityScore: string;
  };
}

const profileFormSchema = z.object({
  phone: z.string().optional(),
  companyName: z.string().optional(),
  bio: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileFormSchema>;

const documentTypeLabels: Record<string, string> = {
  license: "Driving License",
  pan_card: "PAN Card",
  aadhar: "Aadhaar Card",
  aadhaar: "Aadhaar Card",
};

const badgeLevelStyles: Record<string, string> = {
  bronze: "bg-amber-700 text-white",
  silver: "bg-slate-400 text-white",
  gold: "bg-yellow-500 text-black",
  platinum: "bg-slate-600 text-white",
};

export default function MyInfoPage() {
  const { user, carrierType } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      phone: "",
      companyName: "",
      bio: "",
    },
  });

  const { data: profile, isLoading, error } = useQuery<SoloProfile>({
    queryKey: ["/api/carrier/solo/profile"],
    enabled: !!user && user.role === "carrier" && carrierType === "solo",
  });

  // Fetch real-time performance data
  interface PerformanceData {
    hasData: boolean;
    totalTrips: number;
    overallScore: number | null;
    reliabilityScore: number | null;
    communicationScore: number | null;
    onTimeRate: number | null;
    totalRatings: number;
  }

  const { data: performanceData } = useQuery<PerformanceData>({
    queryKey: ["/api/carrier/performance"],
    enabled: !!user && user.role === "carrier" && carrierType === "solo",
  });

  const updateMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      return apiRequest("PATCH", "/api/carrier/solo/profile", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/carrier/solo/profile"] });
      setIsEditing(false);
      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: "Failed to update profile. Please try again.",
      });
    },
  });

  // WebSocket for real-time rating notifications
  const wsRef = useRef<WebSocket | null>(null);
  
  useEffect(() => {
    if (!user || user.role !== "carrier") return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/marketplace`;

    const connect = () => {
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        // Identify as carrier
        wsRef.current?.send(JSON.stringify({
          type: "identify",
          role: "carrier",
          userId: user.id,
        }));
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === "rating_received") {
            // Show toast notification with the new rating
            toast({
              title: "New Rating Received",
              description: `${message.shipperName} rated you ${message.rating} out of 5 stars${message.review ? `: "${message.review}"` : ""}. Your average rating is now ${message.averageRating}.`,
            });

            // Check for badge level upgrade and show special notification
            if (message.badgeLevel) {
              const badgeLabels: Record<string, string> = {
                bronze: "Bronze",
                silver: "Silver",
                gold: "Gold",
              };
              const currentBadge = badgeLabels[message.badgeLevel] || message.badgeLevel;
              
              // Show badge progress info
              if (message.qualifyingRatingsCount !== undefined) {
                let progressMessage = "";
                if (message.badgeLevel === "bronze" && message.qualifyingRatingsCount > 0) {
                  const remaining = 250 - message.qualifyingRatingsCount;
                  if (remaining > 0) {
                    progressMessage = `${remaining} more 3.5+ star ratings to Silver badge`;
                  }
                } else if (message.badgeLevel === "silver") {
                  const remaining = 550 - message.qualifyingRatingsCount;
                  if (remaining > 0) {
                    progressMessage = `${remaining} more 3.5+ star ratings to Gold badge`;
                  }
                }
                
                if (progressMessage) {
                  toast({
                    title: `${currentBadge} Driver`,
                    description: progressMessage,
                  });
                }
              }
            }
            
            // Refresh profile and performance data to show updated rating
            queryClient.invalidateQueries({ queryKey: ["/api/carrier/solo/profile"] });
            queryClient.invalidateQueries({ queryKey: ["/api/carrier/performance"] });
          }
        } catch (error) {
          console.error("WebSocket message parse error:", error);
        }
      };

      wsRef.current.onclose = () => {
        // Reconnect after a delay
        setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [user, toast]);

  const handleEdit = () => {
    if (profile) {
      form.reset({
        phone: profile.user.phone || "",
        companyName: profile.user.companyName || "",
        bio: profile.carrierProfile?.bio || "",
      });
    }
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    form.reset();
  };

  const onSubmit = (data: ProfileFormData) => {
    updateMutation.mutate(data);
  };

  if (carrierType === undefined) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" data-testid="skeleton-title" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-80" data-testid="skeleton-card-1" />
          <Skeleton className="h-80" data-testid="skeleton-card-2" />
        </div>
      </div>
    );
  }

  if (carrierType !== "solo") {
    return (
      <div className="p-6">
        <Alert data-testid="alert-access-restricted">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Access Restricted</AlertTitle>
          <AlertDescription>This page is only available for solo carriers.</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" data-testid="skeleton-title" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-80" data-testid="skeleton-card-1" />
          <Skeleton className="h-80" data-testid="skeleton-card-2" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert variant="destructive" data-testid="alert-error">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Failed to load profile. Please try again.</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-6">
        <Alert data-testid="alert-not-found">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Profile Not Found</AlertTitle>
          <AlertDescription>Unable to load your profile information.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const { user: profileUser, carrierProfile, truck, driverDocuments, stats } = profile;

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-page-title">My Info</h1>
        {!isEditing ? (
          <Button variant="outline" onClick={handleEdit} data-testid="button-edit-profile" className="w-full sm:w-auto" size="sm">
            <Edit2 className="h-4 w-4 mr-2" />
            Edit Profile
          </Button>
        ) : (
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={handleCancel} data-testid="button-cancel-edit" className="flex-1 sm:flex-none" size="sm">
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button 
              onClick={form.handleSubmit(onSubmit)} 
              disabled={updateMutation.isPending} 
              data-testid="button-save-profile"
              className="flex-1 sm:flex-none"
              size="sm"
            >
              <Save className="h-4 w-4 mr-2" />
              {updateMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card data-testid="card-personal-info">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <User className="h-4 w-4 sm:h-5 sm:w-5" />
              Personal Information
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">Your driver profile details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 sm:space-y-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <Avatar className="h-12 w-12 sm:h-16 sm:w-16 shrink-0" data-testid="avatar-user">
                {profileUser.avatar && (
                  <AvatarImage 
                    src={profileUser.avatar} 
                    alt={profileUser.username || "Driver"} 
                    className="object-cover"
                  />
                )}
                <AvatarFallback className="bg-primary/10 text-primary text-base sm:text-xl">
                  {profileUser.username?.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-base sm:text-lg font-semibold truncate" data-testid="text-username">{profileUser.username}</p>
                {profileUser.userNumber && (
                  <p className="text-xs font-mono text-muted-foreground" data-testid="text-user-id">
                    USR-{String(profileUser.userNumber).padStart(3, '0')}
                  </p>
                )}
                {carrierProfile && (
                  <Badge 
                    className={`${badgeLevelStyles[carrierProfile.badgeLevel] || "bg-amber-700 text-white"} text-xs mt-1`}
                    data-testid="badge-level"
                  >
                    <Award className="h-3 w-3 mr-1" />
                    {carrierProfile.badgeLevel.charAt(0).toUpperCase() + carrierProfile.badgeLevel.slice(1)} Driver
                  </Badge>
                )}
              </div>
            </div>

            {isEditing ? (
              <Form {...form}>
                <form className="space-y-4">
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder=""
                            data-testid="input-phone"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="companyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Driver Name</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder=""
                            data-testid="input-driver-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="bio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>About Me</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Tell shippers about yourself and your experience"
                            className="min-h-[100px]"
                            data-testid="input-bio"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </form>
              </Form>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-center gap-2 sm:gap-3" data-testid="info-email">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm text-muted-foreground">Email</p>
                    <p className="font-medium text-sm sm:text-base truncate" data-testid="text-email">{profileUser.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-3" data-testid="info-phone">
                  <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium text-sm sm:text-base truncate" data-testid="text-phone">
                      {profileUser.phone || "Not provided"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-3" data-testid="info-driver-name">
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm text-muted-foreground">Driver Name</p>
                    <p className="font-medium text-sm sm:text-base truncate" data-testid="text-driver-name">
                      {profileUser.companyName || "Not provided"}
                    </p>
                  </div>
                </div>
                {carrierProfile?.bio && (
                  <div className="pt-3 sm:pt-4 border-t" data-testid="info-bio">
                    <p className="text-xs sm:text-sm text-muted-foreground mb-1">About</p>
                    <p className="text-xs sm:text-sm" data-testid="text-bio">{carrierProfile.bio}</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-performance">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Star className="h-4 w-4 sm:h-5 sm:w-5" />
              Performance & Stats
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">Your driving performance metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
              <div className="p-3 sm:p-4 rounded-lg bg-muted/50 text-center" data-testid="stat-rating">
                <p className="text-2xl sm:text-3xl font-bold text-primary" data-testid="text-rating">
                  {performanceData?.overallScore !== null && performanceData?.overallScore !== undefined 
                    ? performanceData.overallScore.toFixed(1)
                    : parseFloat(stats.rating).toFixed(1)}
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground flex items-center justify-center gap-1">
                  <Star className="h-3 w-3" /> Rating
                </p>
              </div>
              <div className="p-3 sm:p-4 rounded-lg bg-muted/50 text-center" data-testid="stat-completed-trips">
                <p className="text-2xl sm:text-3xl font-bold" data-testid="text-completed-trips">
                  {performanceData?.totalTrips ?? stats.completedTrips}
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground">Trips Completed</p>
              </div>
            </div>

            {truck && (
              <div className="pt-3 sm:pt-4 border-t space-y-2 sm:space-y-3" data-testid="section-truck">
                <div className="flex items-center gap-2 text-xs sm:text-sm font-medium">
                  <Truck className="h-4 w-4" />
                  My Truck
                </div>
                <div className="p-2 sm:p-3 rounded-lg border" data-testid="card-truck-summary">
                  <p className="font-medium text-sm sm:text-base" data-testid="text-truck-plate">{truck.licensePlate}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground" data-testid="text-truck-details">
                    {truck.truckType} - {truck.capacity} tons
                  </p>
                </div>
              </div>
            )}

            <div className="pt-3 sm:pt-4 border-t mt-3 sm:mt-4 space-y-2" data-testid="section-scores">
              <p className="text-xs sm:text-sm font-medium">Performance Scores</p>
              <div className="space-y-2">
                <div className="flex justify-between items-center" data-testid="score-reliability">
                  <span className="text-xs sm:text-sm text-muted-foreground">Reliability</span>
                  <span className="font-medium text-sm sm:text-base" data-testid="text-reliability-score">
                    {performanceData?.reliabilityScore !== null && performanceData?.reliabilityScore !== undefined 
                      ? `${performanceData.reliabilityScore}/5.0` 
                      : "N/A"}
                  </span>
                </div>
                <div className="flex justify-between items-center" data-testid="score-communication">
                  <span className="text-xs sm:text-sm text-muted-foreground">Communication</span>
                  <span className="font-medium text-sm sm:text-base" data-testid="text-communication-score">
                    {performanceData?.communicationScore !== null && performanceData?.communicationScore !== undefined 
                      ? `${performanceData.communicationScore}/5.0` 
                      : "N/A"}
                  </span>
                </div>
                <div className="flex justify-between items-center" data-testid="score-ontime">
                  <span className="text-xs sm:text-sm text-muted-foreground">On-Time Delivery</span>
                  <span className="font-medium text-sm sm:text-base" data-testid="text-ontime-score">
                    {performanceData?.onTimeRate !== null && performanceData?.onTimeRate !== undefined 
                      ? `${performanceData.onTimeRate}%` 
                      : "N/A"}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-driver-documents">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
            Driver Documents
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">Your personal documents and licenses</CardDescription>
        </CardHeader>
        <CardContent>
          {driverDocuments.length === 0 ? (
            <div className="text-center py-6 sm:py-8 text-muted-foreground" data-testid="empty-documents">
              <FileText className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No driver documents uploaded yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {driverDocuments.map((doc) => (
                <div 
                  key={doc.id}
                  className="flex items-center justify-between p-2 sm:p-3 rounded-lg border gap-2"
                  data-testid={`card-document-${doc.id}`}
                >
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                    {doc.isVerified ? (
                      <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 shrink-0" data-testid={`icon-verified-${doc.id}`} />
                    ) : (
                      <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-amber-500 shrink-0" data-testid={`icon-pending-${doc.id}`} />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-xs sm:text-sm truncate" data-testid={`text-doc-type-${doc.id}`}>
                        {documentTypeLabels[doc.documentType] || doc.documentType}
                      </p>
                      <p className="text-xs text-muted-foreground truncate" data-testid={`text-doc-filename-${doc.id}`}>
                        {doc.fileName}
                      </p>
                    </div>
                  </div>
                  <Badge 
                    variant={doc.isVerified ? "default" : "secondary"}
                    data-testid={`badge-status-${doc.id}`}
                    className="text-xs shrink-0"
                  >
                    {doc.isVerified ? "Verified" : "Pending"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
