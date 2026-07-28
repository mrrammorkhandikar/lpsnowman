import { useState, useRef, useEffect, useCallback } from "react";
import { User, Bell, Shield, Moon, Sun, LogOut, Camera, Loader2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { AuthenticatedAvatar } from "@/components/authenticated-avatar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-provider";
import { queryClient } from "@/lib/queryClient";
import { apiPatch, apiPost } from "@/lib/api-client";
import { useUpload } from "@/hooks/use-upload";
import { useQuery } from "@tanstack/react-query";

interface ShipperRatingData {
  averageRating: number | null;
  totalRatings: number;
  ratingDistribution: { 1: number; 2: number; 3: number; 4: number; 5: number };
}

const defaultNotifications = {
  email: true,
  push: true,
  bids: true,
  shipments: true,
  documents: false,
};

function notificationStorageKey(userId: string) {
  return `notification_prefs_${userId}`;
}

export default function SettingsPage() {
  const { user, logout, refreshUser, isLoggingOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentPasswordRef = useRef<HTMLInputElement>(null);
  const newPasswordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);

  const [notifications, setNotifications] = useState(defaultNotifications);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [phoneError, setPhoneError] = useState("");

  useEffect(() => {
    if (!user?.id) return;
    setUsername(user.username ?? "");
    setEmail(user.email ?? "");
    setCompanyName(user.companyName ?? "");
    setPhone(user.phone ?? "");
    try {
      const raw = localStorage.getItem(notificationStorageKey(user.id));
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<typeof defaultNotifications>;
        setNotifications({ ...defaultNotifications, ...parsed });
      } else {
        setNotifications(defaultNotifications);
      }
    } catch {
      setNotifications(defaultNotifications);
    }
  }, [user?.id, user?.username, user?.email, user?.companyName, user?.phone]);

  const persistNotifications = useCallback(
    (next: typeof defaultNotifications) => {
      if (user?.id) {
        localStorage.setItem(notificationStorageKey(user.id), JSON.stringify(next));
      }
    },
    [user?.id],
  );

  const updateNotifications = (patch: Partial<typeof defaultNotifications>) => {
    setNotifications((prev) => {
      const next = { ...prev, ...patch };
      persistNotifications(next);
      return next;
    });
  };

  const { data: shipperRating, isLoading: shipperRatingLoading, isError: shipperRatingError } =
    useQuery<ShipperRatingData>({
      queryKey: ["/api/shipper", user?.id, "rating"],
      enabled: user?.role === "shipper" && !!user?.id,
    });

  const { uploadFile, isUploading, error: uploadError } = useUpload({
    onSuccess: async (response) => {
      try {
        const updateResponse = await fetch("/api/user/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ avatar: response.objectPath }),
        });

        if (!updateResponse.ok) {
          throw new Error("Failed to update profile");
        }

        queryClient.invalidateQueries({ queryKey: ["/api/user"] });
        await refreshUser();
        toast({
          title: "Photo updated",
          description: "Your profile photo has been updated successfully.",
        });
      } catch (err) {
        console.error("Profile update error:", err);
        toast({
          title: "Update failed",
          description: "Photo uploaded but failed to save. Please try again.",
          variant: "destructive",
        });
      }
    },
    onError: (err) => {
      console.error("Upload error:", err);
      toast({
        title: "Upload failed",
        description: err.message || "Failed to upload your profile photo. Please try again.",
        variant: "destructive",
      });
    },
  });

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;

  const validateEmail = (value: string) => {
    const v = value.trim();
    if (!v) { setEmailError("Email is required"); return false; }
    if (!EMAIL_REGEX.test(v)) { setEmailError("Enter a valid email address"); return false; }
    setEmailError("");
    return true;
  };

  const validatePhone = (value: string) => {
    const digits = value.replace(/\D/g, "");
    const normalized =
      digits.length === 12 && digits.startsWith("91") ? digits.slice(-10) :
      digits.length === 11 && digits.startsWith("0") ? digits.slice(-10) :
      digits.length === 10 ? digits : "";
    if (!value.trim()) { setPhoneError(""); return true; }
    if (!INDIAN_MOBILE_REGEX.test(normalized)) {
      setPhoneError("Enter a valid 10-digit Indian mobile number");
      return false;
    }
    setPhoneError("");
    return true;
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    const isEmailValid = validateEmail(email);
    const isPhoneValid = validatePhone(phone);
    if (!isEmailValid || !isPhoneValid) return;
    setIsSavingProfile(true);
    try {
      const res = await apiPatch("api/user/profile", {
        username: username.trim(),
        email: email.trim(),
        companyName: companyName.trim() || null,
        phone: phone.trim() || null,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({
          title: "Could not save profile",
          description: (body as { error?: string }).error || "Please check your details and try again.",
          variant: "destructive",
        });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      await refreshUser();
      toast({
        title: "Settings saved",
        description: "Your profile has been updated successfully.",
      });
    } catch (e) {
      console.error(e);
      toast({
        title: "Could not save profile",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePasswordUpdate = async () => {
    const currentPassword = (currentPasswordRef.current?.value ?? "").trim();
    const newPassword = (newPasswordRef.current?.value ?? "").trim();
    const confirmPassword = (confirmPasswordRef.current?.value ?? "").trim();

    if (!currentPassword || !newPassword) {
      toast({
        title: "Missing fields",
        description: "Enter your current password and a new password.",
        variant: "destructive",
      });
      return;
    }
    if (newPassword.length < 8) {
      toast({
        title: "Password too short",
        description: "Use at least 8 characters for your new password.",
        variant: "destructive",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords do not match",
        description: "New password and confirmation must match.",
        variant: "destructive",
      });
      return;
    }

    setIsUpdatingPassword(true);
    try {
      // Uses long-standing POST /api/auth/reset-password (session + currentPassword + newPassword, no otpId).
      const res = await apiPost("api/auth/reset-password", {
        currentPassword,
        newPassword,
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        const description =
          body.error || body.message || `Request failed (${res.status}). Please try again.`;
        toast({
          title: "Could not update password",
          description,
          variant: "destructive",
        });
        return;
      }
      if (currentPasswordRef.current) currentPasswordRef.current.value = "";
      if (newPasswordRef.current) newPasswordRef.current.value = "";
      if (confirmPasswordRef.current) confirmPasswordRef.current.value = "";
      toast({
        title: "Password updated",
        description: "Your password has been changed successfully.",
      });
    } catch (e) {
      console.error(e);
      toast({
        title: "Could not update password",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/heic",
      "image/heif",
    ];
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const extOk = ["jpg", "jpeg", "png", "gif", "webp", "heic", "heif"].includes(ext);
    const looseType = !file.type || file.type === "application/octet-stream";
    if (!validTypes.includes(file.type) && !(extOk && looseType)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a JPEG, PNG, GIF, WebP, or HEIC/HEIF image.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 5MB.",
        variant: "destructive",
      });
      return;
    }

    await uploadFile(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account and preferences.</p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" />
              Profile Information
            </CardTitle>
            <CardDescription>Update your account details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-6">
              <div className="relative">
                <AuthenticatedAvatar
                  src={user?.avatar}
                  alt={user?.username}
                  fallback={getInitials(user?.companyName || user?.username)}
                  className="h-20 w-20"
                  fallbackClassName="text-lg bg-primary/10 text-primary"
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif,.heic,.heif"
                  onChange={handlePhotoUpload}
                  className="hidden"
                  data-testid="input-profile-photo"
                />
                <Button
                  size="icon"
                  variant="secondary"
                  className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full shadow-md"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  data-testid="button-upload-photo"
                >
                  {isUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <div>
                <p className="font-medium">Profile Photo</p>
                <p className="text-sm text-muted-foreground">
                  Click the camera icon to upload a new photo
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Max 5MB. JPG, PNG, GIF, WebP, or HEIC/HEIF
                </p>
                {uploadError ? (
                  <p className="text-xs text-destructive mt-1">{uploadError.message}</p>
                ) : null}
              </div>
            </div>
            <Separator />
            {(user as { userNumber?: number })?.userNumber != null && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                <Shield className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">User ID:</span>
                <span className="text-sm font-mono font-medium" data-testid="text-user-id">
                  USR-{String((user as { userNumber?: number }).userNumber).padStart(3, "0")}
                </span>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  data-testid="input-username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (emailError) validateEmail(e.target.value); }}
                  onBlur={(e) => validateEmail(e.target.value)}
                  className={emailError ? "border-destructive" : ""}
                  data-testid="input-email"
                />
                {emailError && <p className="text-xs text-destructive">{emailError}</p>}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="company">Company Name</Label>
                <Input
                  id="company"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  data-testid="input-company"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={phone}
                  inputMode="numeric"
                  maxLength={15}
                  onChange={(e) => { setPhone(e.target.value); if (phoneError) validatePhone(e.target.value); }}
                  onBlur={(e) => validatePhone(e.target.value)}
                  className={phoneError ? "border-destructive" : ""}
                  data-testid="input-phone"
                />
                {phoneError && <p className="text-xs text-destructive">{phoneError}</p>}
              </div>
            </div>
            <Button
              onClick={handleSaveProfile}
              disabled={isSavingProfile}
              data-testid="button-save-profile"
            >
              {isSavingProfile ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </CardContent>
        </Card>

        {user?.role === "shipper" && (
          <Card data-testid="card-shipper-rating">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Star className="h-4 w-4" />
                Your Rating
              </CardTitle>
              <CardDescription>How carriers rate their experience with you.</CardDescription>
            </CardHeader>
            <CardContent>
              {shipperRatingLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : shipperRatingError ? (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  Unable to load ratings right now. Please try again later.
                </div>
              ) : shipperRating && shipperRating.totalRatings > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <div className="text-4xl font-bold text-primary">{shipperRating.averageRating}</div>
                      <div className="flex items-center gap-0.5 mt-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`h-4 w-4 ${
                              star <= Math.round(shipperRating.averageRating || 0)
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-muted-foreground"
                            }`}
                          />
                        ))}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {shipperRating.totalRatings}{" "}
                        {shipperRating.totalRatings === 1 ? "rating" : "ratings"}
                      </div>
                    </div>
                    <Separator orientation="vertical" className="h-20" />
                    <div className="flex-1 space-y-2">
                      {[5, 4, 3, 2, 1].map((star) => {
                        const count = shipperRating.ratingDistribution[star as 1 | 2 | 3 | 4 | 5] || 0;
                        const percentage =
                          shipperRating.totalRatings > 0 ? (count / shipperRating.totalRatings) * 100 : 0;
                        return (
                          <div key={star} className="flex items-center gap-2 text-sm">
                            <span className="w-3">{star}</span>
                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                            <Progress value={percentage} className="h-2 flex-1" />
                            <span className="text-muted-foreground w-6 text-right">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  <Star className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No ratings yet</p>
                  <p className="text-sm">Carriers will rate you after completing deliveries.</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              Appearance
            </CardTitle>
            <CardDescription>Customize how the app looks.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Dark Mode</p>
                <p className="text-sm text-muted-foreground">Switch between light and dark themes.</p>
              </div>
              <Switch
                checked={theme === "dark"}
                onCheckedChange={toggleTheme}
                data-testid="switch-dark-mode"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </CardTitle>
            <CardDescription>Choose what you want to be notified about. Preferences are saved on this device.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Email Notifications</p>
                <p className="text-sm text-muted-foreground">Receive updates via email.</p>
              </div>
              <Switch
                checked={notifications.email}
                onCheckedChange={(checked) => updateNotifications({ email: checked })}
                data-testid="switch-email-notifications"
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Push Notifications</p>
                <p className="text-sm text-muted-foreground">Receive in-app notifications.</p>
              </div>
              <Switch
                checked={notifications.push}
                onCheckedChange={(checked) => updateNotifications({ push: checked })}
                data-testid="switch-push-notifications"
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Bid Updates</p>
                <p className="text-sm text-muted-foreground">Get notified when you receive or win bids.</p>
              </div>
              <Switch
                checked={notifications.bids}
                onCheckedChange={(checked) => updateNotifications({ bids: checked })}
                data-testid="switch-bid-notifications"
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Shipment Updates</p>
                <p className="text-sm text-muted-foreground">Track shipment status changes.</p>
              </div>
              <Switch
                checked={notifications.shipments}
                onCheckedChange={(checked) => updateNotifications({ shipments: checked })}
                data-testid="switch-shipment-notifications"
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Document Alerts</p>
                <p className="text-sm text-muted-foreground">Reminders for uploads and paperwork.</p>
              </div>
              <Switch
                checked={notifications.documents}
                onCheckedChange={(checked) => updateNotifications({ documents: checked })}
                data-testid="switch-document-notifications"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Security
            </CardTitle>
            <CardDescription>Manage your security settings.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <Input id="current-password" type="password" ref={currentPasswordRef} data-testid="input-current-password" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input id="new-password" type="password" ref={newPasswordRef} data-testid="input-new-password" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  ref={confirmPasswordRef}
                  data-testid="input-confirm-password"
                />
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              data-testid="button-update-password"
              onClick={handlePasswordUpdate}
              disabled={isUpdatingPassword}
            >
              {isUpdatingPassword ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating…
                </>
              ) : (
                "Update Password"
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-base text-destructive">Account Actions</CardTitle>
            <CardDescription>Irreversible actions.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              onClick={logout}
              disabled={isLoggingOut}
              data-testid="button-logout"
            >
              {isLoggingOut ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4 mr-2" />
              )}
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
