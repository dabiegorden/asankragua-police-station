"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, MailCheck, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { toast } from "sonner";

export type UserRole = "admin" | "nco" | "cid" | "so" | "dc";

type Step = "credentials" | "otp";

export default function LoginPage() {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // OTP step state
  const [step, setStep] = useState<Step>("credentials");
  const [otp, setOtp] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const router = useRouter();

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const getDashboardByRole = (role: UserRole): string => {
    switch (role) {
      case "admin":
        return "/admin-dashboard";
      case "nco":
        return "/nco-dashboard";
      case "cid":
        return "/cid-dashboard";
      case "so":
        return "/so-dashboard";
      case "dc":
        return "/dc-dashboard";
      default:
        return "/";
    }
  };

  // Step 1 — verify credentials and trigger the OTP email.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Login failed");
        return;
      }

      setStep("otp");
      setOtp("");
      setResendCooldown(30);
      toast.success("We've sent a verification code to your email");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2 — verify the OTP and complete login.
  const verifyOtp = async (code: string) => {
    setIsVerifying(true);
    try {
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.email, otp: code }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Verification failed");
        setOtp("");
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      toast.success(`Welcome back, ${data.user.fullName.split(" ")[0]}!`);

      const destination = getDashboardByRole(data.user.role as UserRole);
      router.push(destination);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleOtpComplete = (code: string) => {
    if (code.length === 6 && !isVerifying) {
      verifyOtp(code);
    }
  };

  // Resend simply re-runs the credential step to issue a fresh code.
  const handleResend = async () => {
    if (resendCooldown > 0 || isResending) return;
    setIsResending(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || "Could not resend code");
        return;
      }
      setOtp("");
      setResendCooldown(30);
      toast.success("A new verification code has been sent");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setIsResending(false);
    }
  };

  const backToCredentials = () => {
    setStep("credentials");
    setOtp("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="relative h-24 w-24 overflow-hidden rounded-full border-4 border-blue-100 shadow-md">
              <img
                src="/assets/officer.jpg"
                alt="Police officer"
                className="h-full w-full object-cover"
              />
            </div>
          </div>

          <CardTitle className="text-2xl font-bold">
            Police Management System
          </CardTitle>
          <CardDescription>Asankrangwa Police District</CardDescription>
        </CardHeader>

        <CardContent>
          {step === "credentials" ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    autoComplete="current-password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </Button>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Verifying…" : "Sign In"}
              </Button>
            </form>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                  <MailCheck className="h-6 w-6 text-blue-600" />
                </div>
                <p className="text-sm font-medium text-gray-900">
                  Enter verification code
                </p>
                <p className="text-xs text-gray-500">
                  We sent a 6-digit code to{" "}
                  <span className="font-medium text-gray-700">
                    {formData.email}
                  </span>
                  . It expires in 10 minutes.
                </p>
              </div>

              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={otp}
                  onChange={(value) => setOtp(value)}
                  onComplete={handleOtpComplete}
                  disabled={isVerifying}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} className="size-11 text-base" />
                    <InputOTPSlot index={1} className="size-11 text-base" />
                    <InputOTPSlot index={2} className="size-11 text-base" />
                    <InputOTPSlot index={3} className="size-11 text-base" />
                    <InputOTPSlot index={4} className="size-11 text-base" />
                    <InputOTPSlot index={5} className="size-11 text-base" />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <Button
                type="button"
                className="w-full"
                disabled={isVerifying || otp.length !== 6}
                onClick={() => verifyOtp(otp)}
              >
                {isVerifying ? "Verifying…" : "Verify & Sign In"}
              </Button>

              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={backToCredentials}
                  className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-700"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendCooldown > 0 || isResending}
                  className="font-medium text-blue-600 hover:text-blue-700 disabled:text-gray-400 disabled:hover:text-gray-400"
                >
                  {resendCooldown > 0
                    ? `Resend code in ${resendCooldown}s`
                    : isResending
                      ? "Sending…"
                      : "Resend code"}
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
