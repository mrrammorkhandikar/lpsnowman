import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { User, Mail, Phone, Star, Edit2, Camera, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const editProfileSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  licenseNumber: z.string().min(5, "License number is required"),
});

type EditProfileFormData = z.infer<typeof editProfileSchema>;

interface DriverProfile {
  id: string;
  username: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  licenseNumber?: string | null;
  status?: string | null;
  carrierName?: string | null;
  stats: { totalTrips: number; activeTrips: number };
  memberSince?: string | Date | null;
}

export default function DriverProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const { data: profile, isLoading } = useQuery<DriverProfile>({
    queryKey: ["/api/driver/profile"],
    enabled: !!user && user.role === "driver",
  });

  const form = useForm<EditProfileFormData>({
    resolver: zodResolver(editProfileSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      licenseNumber: "",
    },
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        fullName: profile.name || profile.username,
        email: profile.email || "",
        phone: profile.phone || "",
        licenseNumber: profile.licenseNumber || "",
      });
    }
  }, [profile, form]);

  const updateMutation = useMutation({
    mutationFn: async (data: EditProfileFormData) => {
      const response = await apiRequest("PATCH", "/api/driver/profile", {
        name: data.fullName,
        email: data.email,
        phone: data.phone,
        licenseNumber: data.licenseNumber,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/profile"] });
      toast({ title: "Profile updated", description: "Your changes have been saved." });
      setEditDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Update failed", description: "Could not save profile changes.", variant: "destructive" });
    },
  });

  const onSubmit = (data: EditProfileFormData) => {
    updateMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const displayName = profile?.name || profile?.username || user?.username || "Driver";
  const displayEmail = profile?.email || user?.email || "Not provided";
  const displayPhone = profile?.phone || "Not provided";
  const displayLicense = profile?.licenseNumber || "Not provided";
  const displayCity = profile?.carrierName || "—";
  const totalTrips = profile?.stats?.totalTrips ?? 0;
  const memberSince = profile?.memberSince
    ? format(new Date(profile.memberSince), "MMMM yyyy")
    : "—";

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4 md:space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">My Profile</h1>
          <p className="text-muted-foreground mt-1">Manage your driver information</p>
        </div>
        <Button onClick={() => setEditDialogOpen(true)}>
          <Edit2 className="h-4 w-4 mr-2" />
          Edit Profile
        </Button>
      </div>

      <div className="grid gap-3 sm:gap-4 grid-cols-1 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <User className="h-10 w-10 text-primary" />
              </div>
              <Button variant="outline" size="sm" className="mb-4">
                <Camera className="h-4 w-4 mr-2" />
                Add Profile Photo
              </Button>
              <h2 className="text-xl font-bold">{displayName}</h2>
              <Badge className="mt-2">
                {profile?.status === "on_trip" ? "On Trip" : "Active Driver"}
              </Badge>
              <div className="flex items-center gap-1 mt-3">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                <span className="font-semibold">{totalTrips}</span>
                <span className="text-muted-foreground text-sm">completed trips</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Full Name</p>
                <p className="font-medium">{displayName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{displayEmail}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Phone</p>
                <p className="font-medium">{displayPhone}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">License Number</p>
                <p className="font-medium">{displayLicense}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Carrier</p>
                <p className="font-medium">{displayCity}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Member Since</p>
                <p className="font-medium">{memberSince}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-4 sm:pt-6">
            <div>
              <p className="text-sm text-muted-foreground">Total Trips</p>
              <p className="text-2xl font-bold mt-2">{totalTrips}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 sm:pt-6">
            <div>
              <p className="text-sm text-muted-foreground">Active Trips</p>
              <p className="text-2xl font-bold mt-2">{profile?.stats?.activeTrips ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 sm:pt-6">
            <div>
              <p className="text-sm text-muted-foreground">Username</p>
              <p className="text-2xl font-bold mt-2">{profile?.username || user?.username}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
            <DialogDescription>Update your driver information</DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter your full name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="Enter your email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter your phone number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="licenseNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>License Number</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter your license number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditDialogOpen(false)}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button type="submit" className="w-full sm:w-auto" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
