import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Truck, Eye, EyeOff, ArrowRight, Phone, Shield, CheckCircle, Loader2, KeyRound, Mail, ArrowLeft } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import type { UserRole } from "@/shared/schema";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { getApiUrl } from "@/lib/api-client";

const AUTH_OTP_TIMEOUT_MS = 45_000;

/** Indian mobile: 10 digits starting 6–9, or 12 digits with leading 91. Ignores spaces, dashes, and other separators. */
function isIndianMobileFormatOk(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  const core =
    digits.length === 12 && digits.startsWith("91")
      ? digits.slice(-10)
      : digits.length === 10
        ? digits
        : "";
  return core.length === 10 && /^[6-9]\d{9}$/.test(core);
}

/** India PIN: exactly 6 digits when provided; empty is allowed (optional field). */
function isIndiaPostalPinOk(raw: string | undefined): boolean {
  const pc = (raw ?? "").trim().replace(/\s/g, "");
  if (!pc) return true;
  return /^\d{6}$/.test(pc);
}

async function postAuthJson<T = Record<string, unknown>>(
  relativePath: string,
  body: unknown
): Promise<{ ok: boolean; status: number; data: T }> {
  const path = relativePath.replace(/^\//, "");
  const url = getApiUrl(path);
  const controller = new AbortController();
  const timer = window.setTimeout(
    () => controller.abort(new DOMException("Request timed out", "TimeoutError")),
    AUTH_OTP_TIMEOUT_MS
  );
  try {
    const res = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = (await res.json().catch(() => ({}))) as T;
    return { ok: res.ok, status: res.status, data };
  } finally {
    clearTimeout(timer);
  }
}

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().optional(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
  role: z.enum(["shipper", "carrier", "admin"]),
  companyName: z.string().optional(),
  companyPhone: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  addressCity: z.string().optional(),
  addressState: z.string().optional(),
  addressPostalCode: z.string().optional(),
  addressCountry: z.string().optional(),
  phone: z.string().optional(),
  carrierType: z.enum(["solo", "enterprise"]).optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
}).refine((data) => {
  if (data.role === "carrier") {
    return !!data.carrierType;
  }
  return true;
}, {
  message: "Carrier type is required for carriers",
  path: ["carrierType"],
}).refine((data) => {
  // At least one of email or phone is required
  const hasEmail = data.email && data.email.trim() !== "";
  const hasPhone = data.phone && data.phone.trim() !== "";
  return hasEmail || hasPhone;
}, {
  message: "Either email or phone number is required",
  path: ["email"],
}).refine((data) => {
  const trimmed = (data.email ?? "").trim();
  if (!trimmed) return true;
  return z.string().email().safeParse(trimmed).success;
}, {
  message: "Invalid email address",
  path: ["email"],
}).refine((data) => {
  if (!(data.phone && data.phone.trim() !== "")) return true;
  return isIndianMobileFormatOk(data.phone);
}, {
  message: "Use a valid Indian mobile: 10 digits starting with 6–9, optional country code +91.",
  path: ["phone"],
}).refine((data) => {
  return isIndiaPostalPinOk(data.addressPostalCode);
}, {
  message: "Postal code must be exactly 6 digits (India PIN).",
  path: ["addressPostalCode"],
});

type LoginFormData = z.infer<typeof loginSchema>;
type RegisterFormData = z.infer<typeof registerSchema>;

export default function AuthPage() {
  const [, navigate] = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  // Phone OTP states
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpId, setOtpId] = useState("");
  const [enteredOtp, setEnteredOtp] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [verifiedPhone, setVerifiedPhone] = useState("");
  
  
  // Login method toggle (password vs OTP) - OTP is default/primary
  const [loginMethod, setLoginMethod] = useState<"password" | "otp">("otp");
  const [loginPhone, setLoginPhone] = useState("");
  const [loginOtpSent, setLoginOtpSent] = useState(false);
  const [loginOtpId, setLoginOtpId] = useState("");
  const [loginOtpCode, setLoginOtpCode] = useState("");
  const [loginEnteredOtp, setLoginEnteredOtp] = useState("");
  const [sendingLoginOtp, setSendingLoginOtp] = useState(false);
  const [verifyingLoginOtp, setVerifyingLoginOtp] = useState(false);
  const [loginOtpCountdown, setLoginOtpCountdown] = useState(0);
  
  // Forgot password state
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [resetStep, setResetStep] = useState<"email" | "otp" | "password">("email");
  const [resetEmailOrPhone, setResetEmailOrPhone] = useState("");
  const [resetOtpId, setResetOtpId] = useState("");
  const [resetOtpCode, setResetOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  
  const { t } = useTranslation();
  const { login, register, setUserDirectly } = useAuth();
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Read tab parameter from URL to determine initial tab
  const urlParams = new URLSearchParams(window.location.search);
  const initialTab = urlParams.get("tab") === "register" ? "register" : "login";

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.play().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (otpCountdown > 0) {
      const timer = setTimeout(() => setOtpCountdown(otpCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [otpCountdown]);

  useEffect(() => {
    if (loginOtpCountdown > 0) {
      const timer = setTimeout(() => setLoginOtpCountdown(loginOtpCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [loginOtpCountdown]);

  
  const handleSendOtp = async () => {
    const phone = registerForm.getValues("phone");
    if (!phone || phone.trim() === "") {
      toast({ title: "Phone Required", description: "Please enter your phone number first.", variant: "destructive" });
      return;
    }

    if (!isIndianMobileFormatOk(phone)) {
      toast({ title: "Invalid Phone", description: "Please enter a valid Indian phone number.", variant: "destructive" });
      return;
    }

    setSendingOtp(true);
    try {
      const { ok, data } = await postAuthJson<{
        otpId?: string;
        otpCode?: string;
        demoOtp?: string;
        error?: string;
      }>("api/auth/otp/send", { phone, otpType: "registration" });

      const shownCode = data.otpCode ?? data.demoOtp ?? "";

      if (ok) {
        setOtpSent(true);
        setOtpCountdown(60);
        setOtpCode(shownCode);
        setOtpId(data.otpId ?? "");
        toast(
          shownCode
            ? {
                title: "OTP Sent!",
                description: `Your verification code is: ${shownCode}. This code is displayed here for demo purposes.`,
                duration: 15000,
              }
            : {
                title: "OTP Sent!",
                description: "A verification code was sent to your phone.",
              }
        );
      } else {
        toast({ title: "Failed to send OTP", description: data.error || "Please try again.", variant: "destructive" });
      }
    } catch (error) {
      const timedOut =
        error instanceof DOMException &&
        (error.name === "TimeoutError" || error.name === "AbortError");
      const msg = timedOut
        ? "Request timed out. Check your connection and try again."
        : "Failed to send OTP. Please try again.";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpId || enteredOtp.length !== 6) {
      toast({ title: "Invalid OTP", description: "Please enter the 6-digit code.", variant: "destructive" });
      return;
    }

    setVerifyingOtp(true);
    try {
      const phone = registerForm.getValues("phone") || "";
      const { ok, data } = await postAuthJson<{ success?: boolean; error?: string }>("api/auth/otp/verify", {
        otpId,
        code: enteredOtp,
        phone,
      });

      if (ok && data.success) {
        setOtpVerified(true);
        setVerifiedPhone(phone);
        toast({ title: "Phone Verified!", description: "Your phone number has been verified successfully." });
      } else {
        toast({ title: "Invalid OTP", description: data.error || "The code you entered doesn't match. Please try again.", variant: "destructive" });
      }
    } catch (error) {
      const timedOut =
        error instanceof DOMException &&
        (error.name === "TimeoutError" || error.name === "AbortError");
      const msg = timedOut ? "Request timed out. Try again." : "Failed to verify OTP. Please try again.";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setVerifyingOtp(false);
    }
  };

  // Login OTP handlers
  const handleSendLoginOtp = async () => {
    if (!loginPhone.trim()) {
      toast({ title: "Phone Required", description: "Please enter your phone number.", variant: "destructive" });
      return;
    }

    if (!isIndianMobileFormatOk(loginPhone)) {
      toast({ title: "Invalid Phone", description: "Please enter a valid Indian phone number.", variant: "destructive" });
      return;
    }

    setSendingLoginOtp(true);
    try {
      const { ok, data } = await postAuthJson<{
        otpId?: string;
        otpCode?: string;
        demoOtp?: string;
        error?: string;
      }>("api/auth/otp/send", { phone: loginPhone, otpType: "login" });

      const shownCode = data.otpCode ?? data.demoOtp ?? "";

      if (ok) {
        setLoginOtpSent(true);
        setLoginOtpCountdown(60);
        setLoginOtpId(data.otpId ?? "");
        setLoginOtpCode(shownCode);
        toast(
          shownCode
            ? {
                title: "OTP Sent!",
                description: `Your login code is: ${shownCode}. This code is displayed here for demo purposes.`,
                duration: 15000,
              }
            : {
                title: "OTP Sent!",
                description: "A login code was sent to your phone.",
              }
        );
      } else {
        toast({ title: "Failed to send OTP", description: data.error || "Please try again.", variant: "destructive" });
      }
    } catch (error) {
      const timedOut =
        error instanceof DOMException &&
        (error.name === "TimeoutError" || error.name === "AbortError");
      const msg = timedOut
        ? "Request timed out. Check your connection and try again."
        : "Failed to send OTP. Please try again.";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSendingLoginOtp(false);
    }
  };

  const handleVerifyLoginOtp = async () => {
    if (!loginOtpId || loginEnteredOtp.length !== 6) {
      toast({ title: "Invalid OTP", description: "Please enter the 6-digit code.", variant: "destructive" });
      return;
    }

    setVerifyingLoginOtp(true);
    try {
      const { ok, data } = await postAuthJson<{
        success?: boolean;
        error?: string;
        user?: any;
      }>("api/auth/otp/verify-login", {
        otpId: loginOtpId,
        code: loginEnteredOtp,
        phone: loginPhone,
      });

      if (ok && data.success) {
        toast({ title: "Welcome back!", description: "You've been logged in successfully." });
        if (data.user) {
          // Set user in React context directly — no page reload, no extra /api/auth/me round trip
          setUserDirectly(data.user);
          navigate("/");
        } else {
          // Fallback: full reload if backend didn't return user (shouldn't happen)
          window.location.href = "/";
        }
      } else {
        toast({ title: "Invalid OTP", description: data.error || "The code you entered doesn't match. Please try again.", variant: "destructive" });
      }
    } catch (error) {
      const timedOut =
        error instanceof DOMException &&
        (error.name === "TimeoutError" || error.name === "AbortError");
      const msg = timedOut ? "Request timed out. Try again." : "Failed to verify OTP. Please try again.";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setVerifyingLoginOtp(false);
    }
  };

  
  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  // Get role and carrierType from URL params for pre-selection
  const roleParam = urlParams.get("role");
  const carrierTypeParam = urlParams.get("carrierType");
  const initialRole = (roleParam === "shipper" || roleParam === "carrier") ? roleParam : "shipper";
  const initialCarrierType = (carrierTypeParam === "solo" || carrierTypeParam === "enterprise") ? carrierTypeParam : undefined;

  const registerForm = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: {
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
      role: initialRole,
      companyName: "",
      companyPhone: "",
      city: "",
      address: "",
      addressCity: "",
      addressState: "",
      addressPostalCode: "",
      addressCountry: "",
      phone: "",
      carrierType: initialCarrierType,
    },
  });

  const selectedRole = registerForm.watch("role");
  const selectedCarrierType = registerForm.watch("carrierType");
  const watchedPhone = registerForm.watch("phone");

  // Reset OTP verification state when phone number changes
  useEffect(() => {
    if (verifiedPhone && watchedPhone !== verifiedPhone) {
      setOtpVerified(false);
      setOtpSent(false);
      setOtpCode("");
      setOtpId("");
      setEnteredOtp("");
      setVerifiedPhone("");
    }
  }, [watchedPhone, verifiedPhone]);

  
  const handleLogin = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      const success = await login(data.username, data.password);
      console.log("Login success:", success);
      if (success) {
        toast({ title: "Welcome back!", description: "You've been logged in successfully." });
        // Check if it's a driver login
        if (data.username === "driver" && data.password === "driver123") {
          navigate("/driver/profile");
        } else {
          navigate("/");
        }
      } else {
        toast({ title: "Login failed", description: "Invalid username or password.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (data: RegisterFormData) => {
    // Users must verify their phone number
    if (!otpVerified) {
      toast({ 
        title: "Phone Verification Required", 
        description: "Please verify your phone number before creating your account.", 
        variant: "destructive" 
      });
      return;
    }

    setIsLoading(true);
    try {
      const result = await register({
        username: data.username,
        email: (data.email ?? "").trim(),
        password: data.password,
        role: data.role as UserRole,
        companyName: data.companyName,
        companyAddress: data.address,
        defaultPickupCity: data.addressCity || data.city,
        phone: data.phone,
        carrierType: data.carrierType,
        city: data.city,
        otpId: otpId || undefined,
        addressCity: data.addressCity,
        addressState: data.addressState,
        addressPostalCode: (data.addressPostalCode ?? "").trim().replace(/\s/g, ""),
        addressCountry: data.addressCountry,
      });
      if (result.success) {
        // Shippers need to complete onboarding before they can post loads
        if (data.role === "shipper") {
          toast({ 
            title: t("auth.accountCreated"), 
            description: t("auth.completeOnboarding"),
          });
          navigate("/shipper/onboarding");
        } else {
          toast({ title: t("auth.accountCreated"), description: t("auth.welcomeToLoadPilot") });
          navigate("/");
        }
      } else {
        toast({ title: "Registration failed", description: result.error || "Please try again.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // Check if user can register (must have verified phone)
  const canRegister = otpVerified;

  // Forgot password handlers
  const handleForgotPasswordOpen = () => {
    setForgotPasswordOpen(true);
    setResetStep("email");
    setResetEmailOrPhone("");
    setResetOtpId("");
    setResetOtpCode("");
    setNewPassword("");
    setConfirmNewPassword("");
  };

  const handleSendResetOtp = async () => {
    if (!resetEmailOrPhone.trim()) {
      toast({ title: "Required", description: "Please enter your email or phone number.", variant: "destructive" });
      return;
    }

    setResetLoading(true);
    try {
      const { ok, data } = await postAuthJson<{ success?: boolean; otpId?: string; message?: string; error?: string; demoOtp?: string }>(
        "api/auth/forgot-password",
        { emailOrPhone: resetEmailOrPhone }
      );

      if (ok) {
        if (data.otpId) {
          setResetOtpId(data.otpId);
          setResetStep("otp");
          const toastMsg = data.demoOtp
            ? `Your reset code is: ${data.demoOtp}`
            : data.message ?? "Check your email or phone for the 6-digit code.";
          toast({ title: "Code Sent!", description: toastMsg, duration: 30000 });
        } else {
          toast({ title: "Sent", description: data.message ?? "If an account exists, a reset code was sent." });
        }
      } else {
        toast({ title: "Error", description: data.error || "Failed to send reset code.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      setResetLoading(false);
    }
  };

  const handleVerifyResetOtp = async () => {
    if (!resetOtpCode || resetOtpCode.length !== 6) {
      toast({ title: "Invalid Code", description: "Please enter the 6-digit code.", variant: "destructive" });
      return;
    }

    setResetLoading(true);
    try {
      const { ok, data } = await postAuthJson<{ success?: boolean; error?: string }>(
        "api/auth/verify-reset-otp",
        { otpId: resetOtpId, otpCode: resetOtpCode }
      );

      if (ok && data.success) {
        setResetStep("password");
        toast({ title: "Verified!", description: "Now set your new password." });
      } else {
        toast({ title: "Invalid Code", description: data.error || "Please try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      setResetLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (newPassword.length < 6) {
      toast({ title: "Weak Password", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }

    if (newPassword !== confirmNewPassword) {
      toast({ title: "Mismatch", description: "Passwords do not match.", variant: "destructive" });
      return;
    }

    setResetLoading(true);
    try {
      const { ok, data } = await postAuthJson<{ success?: boolean; error?: string }>(
        "api/auth/reset-password",
        { otpId: resetOtpId, newPassword }
      );

      if (ok && data.success) {
        setForgotPasswordOpen(false);
        setResetStep("email");
        setResetEmailOrPhone("");
        setResetOtpCode("");
        setResetOtpId("");
        toast({ title: "Success!", description: "Your password has been reset. Please sign in with your new password." });
      } else {
        toast({ title: "Error", description: data.error || "Failed to reset password.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex relative">
      {/* Full-screen video background */}
      <video 
        ref={videoRef}
        autoPlay 
        loop 
        muted 
        playsInline
        preload="auto"
        className="fixed inset-0 w-full h-full object-cover object-center z-0"
        onLoadedData={(e) => (e.target as HTMLVideoElement).play().catch(() => {})}
      >
        <source src="/assets/VN20260316_110532.mp4" type="video/mp4" />
      </video>
      <div className="fixed inset-0 bg-gradient-to-br from-[#060817]/80 via-[#16254F]/70 to-[#060817]/75 z-0" />

      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden z-10">
        <div className="relative z-10 flex flex-col justify-center p-12 text-white">
          <div className="flex items-center gap-3 mb-8">
            <img 
              src="/assets/Purple_and_Black_Modern_Software_Developer_LinkedIn_Banner_1770118882647.png" 
              alt="LoadPilot" 
              className="h-24 w-[400px] object-contain"
            />
          </div>
          <h1 className="text-4xl font-bold mb-4">
            {t("auth.digitalFreightMarketplace")}
          </h1>
          <p className="text-lg text-white/80 mb-8 max-w-md">
            Connect with trusted carriers, post loads, track shipments, and manage your logistics operations all in one platform.
          </p>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                <ArrowRight className="h-4 w-4" />
              </div>
              <span>{t("auth.features.realTimeTracking")}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                <ArrowRight className="h-4 w-4" />
              </div>
              <span>{t("auth.features.competitiveBidding")}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                <ArrowRight className="h-4 w-4" />
              </div>
              <span>{t("auth.features.secureDocuments")}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col relative z-10 min-w-0">
        <div className="flex justify-end gap-2 p-4">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
        <div className="flex-1 flex items-center justify-center p-3 sm:p-6 lg:p-8">
          <div className="w-full max-w-md min-w-0">
          <Card className="w-full shadow-xl bg-white/70 dark:bg-[#0d1525]/70 backdrop-blur-md border-white/30 dark:border-[#16254F]/50 overflow-hidden">
            <CardHeader className="text-center px-4 sm:px-6 pt-4 sm:pt-6 pb-3">
              <div className="flex justify-center mb-3 lg:hidden">
                <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Truck className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
              </div>
              <CardTitle className="text-xl sm:text-2xl">{t("auth.welcomeToFreightFlow")}</CardTitle>
              <CardDescription className="text-xs sm:text-sm">{t("auth.signInOrCreateAccount")}</CardDescription>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
              <Tabs defaultValue={initialTab}>
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="login" data-testid="tab-login">{t("auth.signIn")}</TabsTrigger>
                  <TabsTrigger value="register" data-testid="tab-register">{t("auth.register")}</TabsTrigger>
                </TabsList>

                <TabsContent value="login">
                  <div className="space-y-4">
                    <div className="flex gap-2 p-1 bg-muted rounded-lg min-w-0 overflow-hidden">
                      <Button
                        type="button"
                        variant={loginMethod === "otp" ? "default" : "ghost"}
                        className="flex-1 min-w-0 text-xs sm:text-sm"
                        onClick={() => {
                          setLoginMethod("otp");
                          loginForm.reset();
                        }}
                        data-testid="button-login-otp"
                      >
                        <Phone className="h-4 w-4 mr-1 sm:mr-2 shrink-0" />
                        <span className="truncate">Phone OTP</span>
                      </Button>
                      <Button
                        type="button"
                        variant={loginMethod === "password" ? "default" : "ghost"}
                        className="flex-1 min-w-0 text-xs sm:text-sm"
                        onClick={() => {
                          setLoginMethod("password");
                          setLoginOtpSent(false);
                          setLoginEnteredOtp("");
                        }}
                        data-testid="button-login-password"
                      >
                        <KeyRound className="h-4 w-4 mr-1 sm:mr-2 shrink-0" />
                        <span className="truncate">Password</span>
                      </Button>
                    </div>

                    {loginMethod === "password" ? (
                      <Form {...loginForm}>
                        <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
                          <FormField
                            control={loginForm.control}
                            name="username"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Username, Email or Phone</FormLabel>
                                <FormControl>
                                  <Input placeholder="" {...field} data-testid="input-login-username" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={loginForm.control}
                            name="password"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t("auth.password")}</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Input
                                      type={showPassword ? "text" : "password"}
                                      placeholder=""
                                      {...field}
                                      data-testid="input-login-password"
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="absolute right-0 top-0 h-full"
                                      onClick={() => setShowPassword(!showPassword)}
                                    >
                                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </Button>
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-login">
                            {isLoading ? t("common.loading") : t("auth.signIn")}
                          </Button>
                          <div className="text-center">
                            <Button 
                              type="button" 
                              variant="ghost" 
                              className="text-sm text-muted-foreground p-0 h-auto"
                              onClick={handleForgotPasswordOpen}
                              data-testid="link-forgot-password"
                            >
                              Forgot your password?
                            </Button>
                          </div>
                        </form>
                      </Form>
                    ) : (
                      <div className="space-y-4">
                        {!loginOtpSent ? (
                          <>
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Phone Number</label>
                              <div className="flex gap-2">
                                <Input
                                  type="tel"
                                  placeholder="+91 9876543210"
                                  value={loginPhone}
                                  onChange={(e) => setLoginPhone(e.target.value)}
                                  data-testid="input-login-phone"
                                />
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Enter the phone number registered with your account
                              </p>
                            </div>
                            <Button 
                              type="button" 
                              className="w-full" 
                              onClick={handleSendLoginOtp}
                              disabled={sendingLoginOtp || !loginPhone.trim()}
                              data-testid="button-send-login-otp"
                            >
                              {sendingLoginOtp ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Sending...
                                </>
                              ) : (
                                <>
                                  <Phone className="h-4 w-4 mr-2" />
                                  Send OTP
                                </>
                              )}
                            </Button>
                          </>
                        ) : (
                          <>
                            <div className="text-center p-4 bg-primary/10 rounded-lg">
                              <Phone className="h-8 w-8 mx-auto mb-2 text-primary" />
                              <p className="text-sm font-medium">OTP sent to {loginPhone}</p>
                              {loginOtpCode ? (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Demo Code: <span className="font-mono font-bold">{loginOtpCode}</span>
                                </p>
                              ) : null}
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Enter 6-digit OTP</label>
                              <Input
                                type="text"
                                placeholder="000000"
                                maxLength={6}
                                value={loginEnteredOtp}
                                onChange={(e) => setLoginEnteredOtp(e.target.value.replace(/\D/g, ""))}
                                className="text-center text-lg tracking-widest font-mono"
                                data-testid="input-login-otp-code"
                              />
                            </div>
                            <Button 
                              type="button" 
                              className="w-full" 
                              onClick={handleVerifyLoginOtp}
                              disabled={verifyingLoginOtp || loginEnteredOtp.length !== 6}
                              data-testid="button-verify-login-otp"
                            >
                              {verifyingLoginOtp ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Verifying...
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Verify & Sign In
                                </>
                              )}
                            </Button>
                            <div className="flex items-center justify-between text-sm">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setLoginOtpSent(false);
                                  setLoginEnteredOtp("");
                                }}
                                data-testid="button-change-login-phone" 
                              >
                                <ArrowLeft className="h-4 w-4 mr-1" />
                                Change number
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={handleSendLoginOtp}
                                disabled={loginOtpCountdown > 0 || sendingLoginOtp}
                                data-testid="button-resend-login-otp"
                              >
                                {loginOtpCountdown > 0 ? `Resend in ${loginOtpCountdown}s` : "Resend OTP"}
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="register">
                  <Form {...registerForm}>
                    <form onSubmit={registerForm.handleSubmit(handleRegister)} className="space-y-4">
                      <FormField
                        control={registerForm.control}
                        name="role"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("auth.iAmA")}</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-role">
                                  <SelectValue placeholder={t("auth.selectRole")} />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="shipper">{t("roles.shipper")}</SelectItem>
                                <SelectItem value="carrier">{t("roles.carrier")}</SelectItem>
                                <SelectItem value="admin">{t("roles.admin")}</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      {selectedRole === "carrier" && (
                        <FormField
                          control={registerForm.control}
                          name="carrierType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Carrier Type</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value || ""}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-carrier-type">
                                    <SelectValue placeholder="Select carrier type" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="solo">Solo Driver (Owner-Operator)</SelectItem>
                                  <SelectItem value="enterprise">Fleet / Company</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={registerForm.control}
                          name="username"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Username</FormLabel>
                              <FormControl>
                                <Input placeholder="Username" {...field} data-testid="input-register-username" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={registerForm.control}
                          name="companyName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                {selectedRole === "carrier" && selectedCarrierType === "solo" 
                                  ? "Driver Name" 
                                  : "Company Name"}
                              </FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder={
                                    selectedRole === "carrier" && selectedCarrierType === "solo" 
                                      ? "Your full name" 
                                      : "Company"
                                  } 
                                  {...field} 
                                  data-testid="input-register-company" 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      {selectedRole === "carrier" && (
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={registerForm.control}
                            name="city"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Service Zones <span className="text-muted-foreground font-normal">(e.g. Maharashtra, Gujarat)</span></FormLabel>
                                <FormControl>
                                  <Input 
                                    placeholder="" 
                                    {...field} 
                                    data-testid="input-register-city" 
                                  />
                                </FormControl>
                                <FormDescription className="text-xs">
                                  Enter multiple states or cities separated by commas
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          {selectedCarrierType === "enterprise" && (
                            <FormField
                              control={registerForm.control}
                              name="companyPhone"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Company Phone</FormLabel>
                                  <FormControl>
                                    <Input 
                                      type="tel"
                                      placeholder="+91 22 1234 5678" 
                                      {...field} 
                                      data-testid="input-register-company-phone" 
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}
                        </div>
                      )}
                      
                      <FormField
                        control={registerForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input 
                                type="email" 
                                placeholder="you@company.com" 
                                {...field}
                                onBlur={(e) => {
                                  field.onBlur();
                                  void registerForm.trigger("email");
                                }}
                                data-testid="input-register-email" 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registerForm.control}
                        name="address"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Address</FormLabel>
                            <FormControl>
                              <AddressAutocomplete
                                value={field.value || ""}
                                onChange={field.onChange}
                                onAddressSelect={(address) => {
                                  const streetValue = address.streetAddress || address.formattedAddress;
                                  registerForm.setValue("address", streetValue, { shouldDirty: true, shouldValidate: true });
                                  registerForm.setValue("addressCity", address.city, { shouldDirty: true, shouldValidate: true });
                                  registerForm.setValue("addressState", address.state, { shouldDirty: true, shouldValidate: true });
                                  registerForm.setValue("addressPostalCode", address.postalCode, { shouldDirty: true, shouldValidate: true });
                                  registerForm.setValue("addressCountry", address.country, { shouldDirty: true, shouldValidate: true });
                                }}
                                placeholder="Search for your address"
                                data-testid="input-register-address"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={registerForm.control}
                          name="addressCity"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>City</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-register-address-city" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={registerForm.control}
                          name="addressState"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>State</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-register-address-state" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={registerForm.control}
                          name="addressPostalCode"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Postal Code</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  inputMode="numeric"
                                  autoComplete="postal-code"
                                  maxLength={6}
                                  placeholder="6-digit PIN"
                                  pattern="[0-9]{6}"
                                  title="6-digit India postal PIN"
                                  onBlur={(e) => {
                                    field.onBlur();
                                    void registerForm.trigger("addressPostalCode");
                                  }}
                                  data-testid="input-register-address-postal"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={registerForm.control}
                          name="addressCountry"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Country</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-register-address-country" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="space-y-3">
                        <FormField
                          control={registerForm.control}
                          name="phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Phone Number</FormLabel>
                              <FormControl>
                                <div className="flex gap-2">
                                  <div className="relative flex-1">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input 
                                      type="tel" 
                                      placeholder="+91 98765 43210" 
                                      className="pl-10"
                                      disabled={otpVerified}
                                      {...field}
                                      onBlur={(e) => {
                                        field.onBlur();
                                        void registerForm.trigger("phone");
                                      }}
                                      data-testid="input-register-phone" 
                                    />
                                  </div>
                                  {!otpVerified ? (
                                    <Button 
                                      type="button"
                                      variant="outline"
                                      onClick={handleSendOtp}
                                      disabled={sendingOtp || (otpSent && otpCountdown > 0)}
                                      data-testid="button-send-otp"
                                    >
                                      {sendingOtp ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : otpSent && otpCountdown > 0 ? (
                                        `${otpCountdown}s`
                                      ) : otpSent ? (
                                        "Resend"
                                      ) : (
                                        "Send OTP"
                                      )}
                                    </Button>
                                  ) : (
                                    <div className="flex items-center gap-1 text-green-600 px-3">
                                      <CheckCircle className="h-4 w-4" />
                                      <span className="text-sm font-medium">Verified</span>
                                    </div>
                                  )}
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        {otpSent && !otpVerified && (
                          <div className="space-y-2">
                            <div className="flex gap-2">
                              <div className="relative flex-1">
                                <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                  type="text"
                                  placeholder=""
                                  className="pl-10 tracking-widest font-mono"
                                  maxLength={6}
                                  value={enteredOtp}
                                  onChange={(e) => setEnteredOtp(e.target.value.replace(/\D/g, ""))}
                                  data-testid="input-otp-code"
                                />
                              </div>
                              <Button 
                                type="button"
                                onClick={handleVerifyOtp}
                                disabled={enteredOtp.length !== 6 || verifyingOtp}
                                data-testid="button-verify-otp"
                              >
                                {verifyingOtp ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Enter the code sent to your phone to verify it.
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={registerForm.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Password</FormLabel>
                              <FormControl>
                                <Input type="password" placeholder="Password" {...field} data-testid="input-register-password" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={registerForm.control}
                          name="confirmPassword"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Confirm Password</FormLabel>
                              <FormControl>
                                <Input type="password" placeholder="Confirm" {...field} data-testid="input-register-confirm" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <Button 
                        type="submit" 
                        className="w-full" 
                        disabled={isLoading || !canRegister} 
                        data-testid="button-register"
                      >
                        {isLoading 
                          ? t("auth.creatingAccount") 
                          : !canRegister 
                            ? t("auth.verifyPhoneFirst") 
                            : selectedRole === "shipper" 
                              ? t("auth.submitOnboardingRequest") 
                              : t("auth.createAccount")
                        }
                      </Button>
                    </form>
                  </Form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
          </div>
        </div>
      </div>

      {/* Forgot Password Dialog */}
      <Dialog open={forgotPasswordOpen} onOpenChange={(open) => {
        setForgotPasswordOpen(open);
        if (!open) {
          setResetStep("email");
          setResetEmailOrPhone("");
          setResetOtpId("");
          setResetOtpCode("");
          setNewPassword("");
          setConfirmNewPassword("");
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Reset Password
            </DialogTitle>
            <DialogDescription>
              {resetStep === "email" && "Enter your email or phone number to receive a reset code."}
              {resetStep === "otp" && "Enter the 6-digit code sent to your email or phone."}
              {resetStep === "password" && "Create a new password for your account."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Step 1: Email/Phone Input */}
            {resetStep === "email" && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email or Phone Number</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="email@example.com or 9876543210"
                      value={resetEmailOrPhone}
                      onChange={(e) => setResetEmailOrPhone(e.target.value)}
                      className="pl-10"
                      data-testid="input-reset-email-phone"
                    />
                  </div>
                </div>
                <Button 
                  className="w-full" 
                  onClick={handleSendResetOtp}
                  disabled={resetLoading}
                  data-testid="button-send-reset-code"
                >
                  {resetLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Send Reset Code
                </Button>
              </>
            )}

            {/* Step 2: OTP Verification */}
            {resetStep === "otp" && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Verification Code <span className="text-muted-foreground font-normal">(6 digits)</span></label>
                  <Input
                    placeholder=""
                    value={resetOtpCode}
                    onChange={(e) => setResetOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    maxLength={6}
                    className="text-center text-lg tracking-widest"
                    data-testid="input-reset-otp"
                  />
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setResetStep("email")}
                    className="flex-1"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                  <Button 
                    className="flex-1" 
                    onClick={handleVerifyResetOtp}
                    disabled={resetLoading || resetOtpCode.length !== 6}
                    data-testid="button-verify-reset-otp"
                  >
                    {resetLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Verify Code
                  </Button>
                </div>
              </>
            )}

            {/* Step 3: New Password */}
            {resetStep === "password" && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">New Password</label>
                  <div className="relative">
                    <Input
                      type={showNewPassword ? "text" : "password"}
                      placeholder=""
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      data-testid="input-new-password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Confirm New Password</label>
                  <Input
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    data-testid="input-confirm-new-password"
                  />
                </div>
                {newPassword.length > 0 && newPassword.length < 6 && (
                  <p className="text-sm text-destructive">Password must be at least 6 characters</p>
                )}
                {confirmNewPassword.length > 0 && newPassword !== confirmNewPassword && (
                  <p className="text-sm text-destructive">Passwords do not match</p>
                )}
                <Button 
                  className="w-full" 
                  onClick={handleResetPassword}
                  disabled={resetLoading || newPassword.length < 6 || newPassword !== confirmNewPassword}
                  data-testid="button-reset-password"
                >
                  {resetLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Reset Password
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
