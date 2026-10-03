import { useState, useEffect } from "react";
import { BrandMark } from "@/components/BrandMark";
import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError } from "@/lib/api";
import {
  calculatePasswordStrength,
  passwordRules,
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  verifyResetOtpSchema,
  resetPasswordSchema,
} from "@shared/validation";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  User,
  AlertTriangle,
  Clock,
  RefreshCw,
  ShieldAlert,
  ArrowLeft,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useSearch } from "wouter";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from "@/components/ui/input-otp";

export default function Access() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const { user, isAuthenticated, refresh } = useAuth();

  // Active tab: "signin" | "signup" | "forgot_password" | "verify_email"
  const [activeTab, setActiveTab] = useState<"signin" | "signup" | "forgot_password" | "verify_email">("signin");

  // Sign In states
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [signInTotp, setSignInTotp] = useState("");
  const [signInRequires2fa, setSignInRequires2fa] = useState(false);
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [signInError, setSignInError] = useState("");
  const [signInFieldErrors, setSignInFieldErrors] = useState<Record<string, string[]>>({});
  const [isSigningIn, setIsSigningIn] = useState(false);

  // Lockout countdown timer
  const [lockoutSeconds, setLockoutSeconds] = useState<number | null>(null);

  // Sign Up states
  const [signUpName, setSignUpName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState("");
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [showSignUpConfirm, setShowSignUpConfirm] = useState(false);
  const [signUpError, setSignUpError] = useState("");
  const [signUpFieldErrors, setSignUpFieldErrors] = useState<Record<string, string[]>>({});
  const [isSigningUp, setIsSigningUp] = useState(false);

  // Email Verification states
  const [verifyEmail, setVerifyEmail] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyCountdown, setVerifyCountdown] = useState<number>(600); // 10:00 (600s)
  const [verifyResendCountdown, setVerifyResendCountdown] = useState<number>(60); // 60s cooldown
  const [verifyRemainingAttempts, setVerifyRemainingAttempts] = useState<number>(5);
  const [verifyError, setVerifyError] = useState("");
  const [verifyInfo, setVerifyInfo] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const [isVerifySuccess, setIsVerifySuccess] = useState(false);

  // 3-Step Forgot / Reset Password states
  const [forgotStep, setForgotStep] = useState<1 | 2 | 3 | "success">(1);
  const [slideDirection, setSlideDirection] = useState<number>(1);
  const [forgotEmail, setForgotEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [requires2fa, setRequires2fa] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState<number>(600); // 10:00 (600s)
  const [resendCountdown, setResendCountdown] = useState<number>(60); // 60s cooldown
  const [remainingAttempts, setRemainingAttempts] = useState<number>(5);
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const [forgotSuccessMessage, setForgotSuccessMessage] = useState("");
  const [forgotFieldErrors, setForgotFieldErrors] = useState<Record<string, string[]>>({});
  const [isForgotLoading, setIsForgotLoading] = useState(false);

  // Live password strengths
  const signUpPasswordStrength = calculatePasswordStrength(signUpPassword);
  const resetPasswordStrength = calculatePasswordStrength(newPassword);

  // Handle URL parameters ?mode=signin | ?mode=signup | ?mode=forgot | ?mode=verify
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const mode = params.get("mode");
    const emailParam = params.get("email");
    if (mode === "signin" || mode === "signup" || mode === "forgot" || mode === "verify") {
      if (mode === "verify") {
        setActiveTab("verify_email");
        if (emailParam) {
          setVerifyEmail(emailParam);
        }
      } else {
        setActiveTab(mode === "forgot" ? "forgot_password" : mode);
      }
    }
  }, [searchString]);

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    if (isAuthenticated && user) {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, user, setLocation]);

  // Lockout interval countdown
  useEffect(() => {
    if (lockoutSeconds === null || lockoutSeconds <= 0) return;
    const interval = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          setSignInError("");
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutSeconds]);

  // OTP countdown timers for Step 2
  useEffect(() => {
    if (forgotStep !== 2) return;
    const interval = setInterval(() => {
      setOtpCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [forgotStep]);

  useEffect(() => {
    if (forgotStep !== 2 || resendCountdown <= 0) return;
    const interval = setInterval(() => {
      setResendCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [forgotStep, resendCountdown]);

  // Email verification countdown timers
  useEffect(() => {
    if (activeTab !== "verify_email") return;
    const interval = setInterval(() => {
      setVerifyCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "verify_email" || verifyResendCountdown <= 0) return;
    const interval = setInterval(() => {
      setVerifyResendCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [activeTab, verifyResendCountdown]);

  const formatCountdown = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Sign In submit handler
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignInError("");
    setSignInFieldErrors({});

    const validation = loginSchema.safeParse({
      email: signInEmail,
      password: signInPassword,
    });

    if (!validation.success) {
      setSignInFieldErrors(validation.error.flatten().fieldErrors);
      return;
    }

    try {
      setIsSigningIn(true);
      const res = await api.login({
        email: signInEmail.trim(),
        password: signInPassword,
        totp: signInTotp.trim() || undefined,
      });

      if (res.requires2fa) {
        setSignInRequires2fa(true);
        toast.info("Two-factor authentication code required.");
        return;
      }

      if (res.success) {
        toast.success(`Welcome back, ${res.user?.name || "User"}!`);
        await refresh();
        setLocation("/dashboard");
      }
    } catch (err: any) {
      if (err instanceof ApiError) {
        if (
          err.status === 403 &&
          (err.code === "EMAIL_NOT_VERIFIED" ||
            err.data?.code === "EMAIL_NOT_VERIFIED" ||
            err.data?.emailVerificationRequired)
        ) {
          const emailToVerify = signInEmail.trim();
          setVerifyEmail(emailToVerify);
          setVerifyCode("");
          setVerifyError("");
          setVerifyInfo("Your email isn't verified yet. We've sent a new code.");
          setVerifyCountdown(600);
          setVerifyRemainingAttempts(5);
          setIsVerifySuccess(false);
          setActiveTab("verify_email");
          setLocation(`/access?mode=verify&email=${encodeURIComponent(emailToVerify)}`);

          // Auto-trigger resend code (respecting cooldown)
          void (async () => {
            try {
              await api.resendVerification({ email: emailToVerify });
              setVerifyResendCountdown(60);
            } catch (resendErr: any) {
              if (resendErr instanceof ApiError && resendErr.status === 429) {
                setVerifyResendCountdown(resendErr.retryAfterSeconds || 60);
              }
            }
          })();
          return;
        } else if (err.status === 429) {
          const waitTime = err.retryAfterSeconds || 15 * 60;
          setLockoutSeconds(waitTime);
          setSignInError(`Too many attempts. Try again in ${formatCountdown(waitTime)}`);
        } else if (err.status === 401) {
          // OWASP: Never reveal which was wrong
          setSignInError(err.message || "Invalid email or password");
        } else {
          setSignInError(err.message || "Failed to sign in. Please try again.");
        }
      } else {
        setSignInError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  // Sign Up submit handler
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignUpError("");
    setSignUpFieldErrors({});

    const validation = registerSchema.safeParse({
      name: signUpName,
      email: signUpEmail,
      password: signUpPassword,
      confirmPassword: signUpConfirmPassword,
    });

    if (!validation.success) {
      setSignUpFieldErrors(validation.error.flatten().fieldErrors);
      return;
    }

    try {
      setIsSigningUp(true);
      const res = await api.register({
        name: signUpName.trim(),
        email: signUpEmail.trim(),
        password: signUpPassword,
      });

      if (res.success) {
        toast.success("Account created! Please check your email for the verification code.");
        const emailToVerify = signUpEmail.trim();
        setVerifyEmail(emailToVerify);
        setVerifyCode("");
        setVerifyError("");
        setVerifyInfo("");
        setVerifyCountdown(600);
        setVerifyResendCountdown(60);
        setVerifyRemainingAttempts(5);
        setIsVerifySuccess(false);
        setActiveTab("verify_email");
        setLocation(`/access?mode=verify&email=${encodeURIComponent(emailToVerify)}`);
      }
    } catch (err: any) {
      setSignUpError(err.message || "Failed to create account. Email may already be in use.");
    } finally {
      setIsSigningUp(false);
    }
  };

  // ── Email Verification Handlers ───────────────────────────────────────────

  const executeVerify = async (codeToVerify: string) => {
    if (isVerifying || isVerifySuccess) return;
    if (codeToVerify.length !== 6) {
      setVerifyError("Please enter the complete 6-digit verification code.");
      return;
    }

    try {
      setIsVerifying(true);
      setVerifyError("");
      setVerifyInfo("");

      const res = await api.verifyEmail({
        email: verifyEmail.trim(),
        code: codeToVerify.trim(),
      });

      if (res.success) {
        setIsVerifySuccess(true);
        toast.success("Email verified");
        await refresh();
        setTimeout(() => {
          setLocation("/dashboard");
        }, 900);
      } else {
        setVerifyError(res.message || "Invalid verification code.");
      }
    } catch (err: any) {
      const msg = err.message || "Invalid or expired verification code.";
      setVerifyError(msg);
      if (err.data?.remainingAttempts !== undefined) {
        setVerifyRemainingAttempts(Number(err.data.remainingAttempts));
      } else {
        const match = msg.match(/(\d+)\s+attempt/i);
        if (match && match[1]) {
          setVerifyRemainingAttempts(parseInt(match[1], 10));
        } else if (msg.toLowerCase().includes("invalidated") || msg.toLowerCase().includes("expired")) {
          setVerifyRemainingAttempts(0);
        }
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendVerification = async () => {
    if (verifyResendCountdown > 0 || isResendingVerification) return;
    try {
      setIsResendingVerification(true);
      setVerifyError("");
      const res = await api.resendVerification({ email: verifyEmail.trim() });
      toast.success("A new verification code has been sent.");
      setVerifyInfo("We've sent a new verification code to your email.");
      setVerifyResendCountdown(60);
      setVerifyCountdown(600);
      setVerifyCode("");
      setVerifyRemainingAttempts(5);
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 429) {
        const waitTime = err.retryAfterSeconds || 60;
        setVerifyResendCountdown(waitTime);
        setVerifyError(`Please wait ${waitTime}s before requesting another code.`);
      } else {
        setVerifyError(err.message || "Failed to resend verification code.");
      }
    } finally {
      setIsResendingVerification(false);
    }
  };

  // ── 3-Step Password Reset Handlers ─────────────────────────────────────────

  // Step 1: Send verification code to email
  const handleSendVerificationCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError("");
    setForgotSuccessMessage("");
    setForgotFieldErrors({});

    const validation = forgotPasswordSchema.safeParse({ email: forgotEmail });
    if (!validation.success) {
      setForgotFieldErrors(validation.error.flatten().fieldErrors);
      return;
    }

    try {
      setIsForgotLoading(true);
      const res = await api.forgotPassword({ email: forgotEmail.trim() });
      setForgotSuccessMessage(res.message || "If that email exists, we've sent a code.");
      toast.success("If that email exists, we've sent a code.");
      setOtpCountdown(600); // 10 minutes
      setResendCountdown(60); // 60s cooldown
      setRemainingAttempts(5);
      setOtpCode("");
      setTotpCode("");
      setRequires2fa(false);
      setSlideDirection(1);
      setForgotStep(2);
    } catch (err: any) {
      // Always show safe neutral message
      setForgotSuccessMessage("If that email exists, we've sent a code.");
      setOtpCountdown(600);
      setResendCountdown(60);
      setSlideDirection(1);
      setForgotStep(2);
    } finally {
      setIsForgotLoading(false);
    }
  };

  // Step 2: Resend code handler
  const handleResendCode = async () => {
    if (resendCountdown > 0) return;
    try {
      setIsForgotLoading(true);
      setForgotError("");
      const res = await api.forgotPassword({ email: forgotEmail.trim() });
      toast.success("A new verification code has been sent.");
      setForgotSuccessMessage(res.message || "If that email exists, we've sent a code.");
      setResendCountdown(60);
      setOtpCountdown(600);
      setOtpCode("");
    } catch (err: any) {
      setForgotError(err.message || "Failed to resend code.");
    } finally {
      setIsForgotLoading(false);
    }
  };

  // Step 2: Verify OTP (+ optional TOTP) handler
  const handleVerifyResetOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError("");
    setForgotFieldErrors({});

    if (otpCode.length !== 6) {
      setForgotError("Please enter the complete 6-digit verification code.");
      return;
    }

    if (requires2fa && totpCode.length !== 6) {
      setForgotError("Please enter your 6-digit authenticator app code.");
      return;
    }

    try {
      setIsForgotLoading(true);
      const res = await api.verifyResetOtp({
        email: forgotEmail.trim(),
        code: otpCode.trim(),
        totp: totpCode.trim() || undefined,
      });

      if (res.requires2fa) {
        setRequires2fa(true);
        toast.info("Two-Factor Authentication is active. Please enter your authenticator app code.");
        return;
      }

      if (res.success && res.resetToken) {
        setResetToken(res.resetToken);
        toast.success("Code verified! Set your new password.");
        setSlideDirection(1);
        setForgotStep(3);
      } else {
        setForgotError(res.message || "Invalid verification code.");
      }
    } catch (err: any) {
      const msg = err.message || "Invalid verification code.";
      setForgotError(msg);
      // If error reveals remaining attempts
      const match = msg.match(/(\d+)\s+attempt/i);
      if (match && match[1]) {
        setRemainingAttempts(parseInt(match[1], 10));
      } else if (msg.includes("invalidated")) {
        setRemainingAttempts(0);
      }
    } finally {
      setIsForgotLoading(false);
    }
  };

  // Step 3: Update password with resetToken handler
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError("");
    setForgotFieldErrors({});

    const validation = resetPasswordSchema.safeParse({
      newPassword,
      confirmNewPassword,
    });

    if (!validation.success) {
      setForgotFieldErrors(validation.error.flatten().fieldErrors);
      return;
    }

    try {
      setIsForgotLoading(true);
      const res = await api.resetPassword({
        resetToken,
        newPassword,
      });

      if (res.success) {
        toast.success("Password updated successfully!");
        setSlideDirection(1);
        setForgotStep("success");
      }
    } catch (err: any) {
      setForgotError(err.message || "Failed to update password.");
    } finally {
      setIsForgotLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#F8F5F3] px-4 py-8 sm:p-10">
      <div className="ambient-dot absolute inset-0 opacity-40" />

      <div className="relative mx-auto max-w-6xl">
        {/* Navigation Bar */}
        <div className="mb-8 flex items-center justify-between">
          <button
            onClick={() => setLocation("/")}
            className="text-xs font-bold text-[#755B73] transition hover:text-[#0B2925] flex items-center gap-1.5"
          >
            ← Back to home
          </button>

          {/* Quick Tab Switcher */}
          <div className="flex rounded-xl bg-white border border-[#E5DDD8] p-1 shadow-sm text-xs font-bold">
            <button
              onClick={() => {
                setActiveTab("signin");
                setLocation("/access?mode=signin");
                setSignInError("");
                setSignInFieldErrors({});
              }}
              className={`rounded-lg px-3 py-1.5 transition ${
                activeTab === "signin"
                  ? "bg-[#0B2925] text-white"
                  : "text-[#524458] hover:text-[#0B2925]"
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => {
                setActiveTab("signup");
                setLocation("/access?mode=signup");
                setSignUpError("");
                setSignUpFieldErrors({});
              }}
              className={`rounded-lg px-3 py-1.5 transition ${
                activeTab === "signup"
                  ? "bg-[#0B2925] text-white"
                  : "text-[#524458] hover:text-[#0B2925]"
              }`}
            >
              Sign Up
            </button>
            <button
              onClick={() => {
                setActiveTab("forgot_password");
                setLocation("/access?mode=forgot");
                setForgotError("");
                setForgotFieldErrors({});
              }}
              className={`rounded-lg px-3 py-1.5 transition ${
                activeTab === "forgot_password"
                  ? "bg-[#0B2925] text-white"
                  : "text-[#524458] hover:text-[#0B2925]"
              }`}
            >
              Forgot Password
            </button>
            {activeTab === "verify_email" && (
              <button
                className="rounded-lg px-3 py-1.5 transition bg-[#0B2925] text-white"
              >
                Verify Email
              </button>
            )}
          </div>
        </div>

        {/* Main Card Container */}
        <section className="overflow-hidden rounded-[2rem] border border-[#E5DDD8] bg-white shadow-[0_24px_90px_rgba(11,41,37,0.1)]">
          <div className="grid lg:grid-cols-[0.88fr_1.12fr]">
            {/* Left Dark-Green Brand Panel */}
            <div className="relative min-h-[380px] overflow-hidden bg-[#0B2925] p-8 sm:p-12 flex flex-col justify-between">
              <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(11,41,37,0.98),rgba(19,61,55,0.9))]" />
              <div className="relative z-10">
                <BrandMark inverse />
              </div>

              <div className="relative z-10 my-8">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#A7F3D0]/40 bg-[#0B2925]/80 px-3.5 py-1.5 text-xs font-semibold text-[#A7F3D0] backdrop-blur-md">
                  <ShieldCheck className="h-3.5 w-3.5 text-[#A7F3D0]" /> Secure Access
                </div>
                <h1 className="font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                  Welcome to SecureAuth
                </h1>
                <p className="mt-4 text-xs leading-relaxed text-[#F8F5F3]/85">
                  Every account is protected with hardened password hashing, encrypted HttpOnly session cookies,
                  and proactive brute-force defense.
                </p>
              </div>

              {/* Bottom Security Checks */}
              <div className="relative z-10 flex flex-wrap items-center gap-4 text-[11px] font-semibold text-[#A7F3D0]">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#A7F3D0]" /> Hashed credentials
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#A7F3D0]" /> HttpOnly sessions
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#A7F3D0]" /> Rate-limited
                </span>
              </div>
            </div>

            {/* Right Interactive Form Area */}
            <div className="p-7 sm:p-10 flex flex-col justify-center">
              <AnimatePresence mode="wait">
                {/* 1. SIGN IN VIEW */}
                {activeTab === "signin" && (
                  <motion.div
                    key="signin"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="flex items-center justify-between">
                      <p className="eyebrow text-[#755B73]">Authentication</p>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab("signup");
                          setSignUpError("");
                          setSignUpFieldErrors({});
                        }}
                        className="text-xs font-bold text-[#0B2925] hover:underline"
                      >
                        Create an account →
                      </button>
                    </div>

                    <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-[#27212B]">
                      Sign in to SecureAuth
                    </h2>

                    <form onSubmit={handleSignIn} className="mt-6 space-y-4">
                      {/* Locked Out Countdown State or Error Box */}
                      {lockoutSeconds !== null && lockoutSeconds > 0 ? (
                        <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700 font-medium flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
                          <span>
                            Too many attempts. Try again in{" "}
                            <strong className="font-mono text-red-900 font-bold">
                              {formatCountdown(lockoutSeconds)}
                            </strong>
                          </span>
                        </div>
                      ) : (
                        signInError && (
                          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 font-medium flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
                            <span>{signInError}</span>
                          </div>
                        )
                      )}

                      {/* Email field */}
                      <div>
                        <label className="block text-xs font-bold text-[#27212B] mb-1">
                          Email Address
                        </label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 h-4 w-4 text-[#755B73]" />
                          <input
                            type="email"
                            value={signInEmail}
                            onChange={(e) => {
                              setSignInEmail(e.target.value);
                              if (signInFieldErrors.email) {
                                setSignInFieldErrors((prev) => ({ ...prev, email: [] }));
                              }
                            }}
                            placeholder="you@domain.com"
                            className="w-full rounded-xl border border-[#E5DDD8] bg-[#F8F5F3] pl-9 pr-4 py-2.5 text-xs text-[#27212B] focus:border-[#0B2925] focus:outline-none focus:ring-1 focus:ring-[#A7F3D0]"
                            required
                          />
                        </div>
                        {signInFieldErrors.email?.[0] && (
                          <p className="mt-1 text-[11px] font-medium text-red-600">
                            {signInFieldErrors.email[0]}
                          </p>
                        )}
                      </div>

                      {/* Password field */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-bold text-[#27212B]">
                            Password
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setForgotEmail(signInEmail);
                              setActiveTab("forgot_password");
                            }}
                            className="text-[11px] font-semibold text-[#755B73] hover:text-[#0B2925]"
                          >
                            Forgot password?
                          </button>
                        </div>
                        <div className="relative">
                          <Lock className="absolute left-3 top-3 h-4 w-4 text-[#755B73]" />
                          <input
                            type={showSignInPassword ? "text" : "password"}
                            value={signInPassword}
                            onChange={(e) => {
                              setSignInPassword(e.target.value);
                              if (signInFieldErrors.password) {
                                setSignInFieldErrors((prev) => ({ ...prev, password: [] }));
                              }
                            }}
                            placeholder="••••••••"
                            className="w-full rounded-xl border border-[#E5DDD8] bg-[#F8F5F3] pl-9 pr-10 py-2.5 text-xs text-[#27212B] focus:border-[#0B2925] focus:outline-none focus:ring-1 focus:ring-[#A7F3D0]"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowSignInPassword(!showSignInPassword)}
                            className="absolute right-3 top-3 text-[#755B73] hover:text-[#0B2925]"
                          >
                            {showSignInPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        {signInFieldErrors.password?.[0] && (
                          <p className="mt-1 text-[11px] font-medium text-red-600">
                            {signInFieldErrors.password[0]}
                          </p>
                        )}
                      </div>

                      {/* 2FA Authenticator Code (shown if account has 2FA enabled) */}
                      {signInRequires2fa && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="rounded-xl border border-[#A7F3D0]/60 bg-[#A7F3D0]/10 p-3.5 space-y-2"
                        >
                          <div className="flex items-center gap-2 text-[#0B2925]">
                            <ShieldCheck className="h-4 w-4 shrink-0 text-[#0B2925]" />
                            <span className="text-xs font-bold">Two-Factor Authentication</span>
                          </div>
                          <p className="text-[11px] text-[#524458]">
                            Enter the 6-digit code from your authenticator app or an emergency recovery code.
                          </p>
                          <div className="flex justify-center pt-1">
                            <InputOTP
                              maxLength={6}
                              value={signInTotp}
                              onChange={(v) => {
                                setSignInTotp(v);
                                setSignInError("");
                              }}
                            >
                              <InputOTPGroup>
                                <InputOTPSlot index={0} />
                                <InputOTPSlot index={1} />
                                <InputOTPSlot index={2} />
                              </InputOTPGroup>
                              <InputOTPSeparator />
                              <InputOTPGroup>
                                <InputOTPSlot index={3} />
                                <InputOTPSlot index={4} />
                                <InputOTPSlot index={5} />
                              </InputOTPGroup>
                            </InputOTP>
                          </div>
                        </motion.div>
                      )}

                      {/* Submit button */}
                      <Button
                        type="submit"
                        disabled={
                          isSigningIn ||
                          (lockoutSeconds !== null && lockoutSeconds > 0) ||
                          (signInRequires2fa && signInTotp.length < 6)
                        }
                        className="w-full h-11 bg-[#0B2925] text-white text-xs font-bold rounded-xl shadow-md hover:bg-[#133D37] disabled:opacity-50"
                      >
                        {isSigningIn ? (
                          <span className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin text-[#A7F3D0]" /> Authenticating...
                          </span>
                        ) : signInRequires2fa ? (
                          "Verify 2FA & Sign In"
                        ) : (
                          "Sign In to Account"
                        )}
                      </Button>
                    </form>
                  </motion.div>
                )}

                {/* 2. SIGN UP VIEW */}
                {activeTab === "signup" && (
                  <motion.div
                    key="signup"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="flex items-center justify-between">
                      <p className="eyebrow text-[#755B73]">New registration</p>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab("signin");
                          setSignInError("");
                          setSignInFieldErrors({});
                        }}
                        className="text-xs font-bold text-[#0B2925] hover:underline"
                      >
                        Already registered? Sign In →
                      </button>
                    </div>

                    <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-[#27212B]">
                      Create your Secure Account
                    </h2>

                    <form onSubmit={handleSignUp} className="mt-4 space-y-3">
                      {signUpError && (
                        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 font-medium flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
                          <span>{signUpError}</span>
                        </div>
                      )}

                      {/* Name input */}
                      <div>
                        <label className="block text-xs font-bold text-[#27212B] mb-1">Full Name</label>
                        <div className="relative">
                          <User className="absolute left-3 top-3 h-4 w-4 text-[#755B73]" />
                          <input
                            type="text"
                            value={signUpName}
                            onChange={(e) => {
                              setSignUpName(e.target.value);
                              if (signUpFieldErrors.name) {
                                setSignUpFieldErrors((prev) => ({ ...prev, name: [] }));
                              }
                            }}
                            placeholder="Alex Morgan"
                            className="w-full rounded-xl border border-[#E5DDD8] bg-[#F8F5F3] pl-9 pr-4 py-2 text-xs text-[#27212B] focus:border-[#0B2925] focus:outline-none focus:ring-1 focus:ring-[#A7F3D0]"
                            required
                          />
                        </div>
                        {signUpFieldErrors.name?.[0] && (
                          <p className="mt-1 text-[11px] font-medium text-red-600">
                            {signUpFieldErrors.name[0]}
                          </p>
                        )}
                      </div>

                      {/* Email input */}
                      <div>
                        <label className="block text-xs font-bold text-[#27212B] mb-1">Email Address</label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 h-4 w-4 text-[#755B73]" />
                          <input
                            type="email"
                            value={signUpEmail}
                            onChange={(e) => {
                              setSignUpEmail(e.target.value);
                              if (signUpFieldErrors.email) {
                                setSignUpFieldErrors((prev) => ({ ...prev, email: [] }));
                              }
                            }}
                            placeholder="you@domain.com"
                            className="w-full rounded-xl border border-[#E5DDD8] bg-[#F8F5F3] pl-9 pr-4 py-2 text-xs text-[#27212B] focus:border-[#0B2925] focus:outline-none focus:ring-1 focus:ring-[#A7F3D0]"
                            required
                          />
                        </div>
                        {signUpFieldErrors.email?.[0] && (
                          <p className="mt-1 text-[11px] font-medium text-red-600">
                            {signUpFieldErrors.email[0]}
                          </p>
                        )}
                      </div>

                      {/* Password + Confirm Password Grid */}
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-[#27212B] mb-1">Password</label>
                          <div className="relative">
                            <Lock className="absolute left-3 top-3 h-4 w-4 text-[#755B73]" />
                            <input
                              type={showSignUpPassword ? "text" : "password"}
                              value={signUpPassword}
                              onChange={(e) => {
                                setSignUpPassword(e.target.value);
                                if (signUpFieldErrors.password) {
                                  setSignUpFieldErrors((prev) => ({ ...prev, password: [] }));
                                }
                              }}
                              placeholder="Min 8 chars, 1 upper..."
                              className="w-full rounded-xl border border-[#E5DDD8] bg-[#F8F5F3] pl-9 pr-10 py-2 text-xs text-[#27212B] focus:border-[#0B2925] focus:outline-none focus:ring-1 focus:ring-[#A7F3D0]"
                              required
                            />
                            <button
                              type="button"
                              onClick={() => setShowSignUpPassword(!showSignUpPassword)}
                              className="absolute right-3 top-2.5 text-[#755B73] hover:text-[#0B2925]"
                            >
                              {showSignUpPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                          {signUpFieldErrors.password?.[0] && (
                            <p className="mt-1 text-[11px] font-medium text-red-600">
                              {signUpFieldErrors.password[0]}
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-[#27212B] mb-1">Confirm Password</label>
                          <div className="relative">
                            <Lock className="absolute left-3 top-3 h-4 w-4 text-[#755B73]" />
                            <input
                              type={showSignUpConfirm ? "text" : "password"}
                              value={signUpConfirmPassword}
                              onChange={(e) => {
                                setSignUpConfirmPassword(e.target.value);
                                if (signUpFieldErrors.confirmPassword) {
                                  setSignUpFieldErrors((prev) => ({ ...prev, confirmPassword: [] }));
                                }
                              }}
                              placeholder="Repeat password"
                              className="w-full rounded-xl border border-[#E5DDD8] bg-[#F8F5F3] pl-9 pr-10 py-2 text-xs text-[#27212B] focus:border-[#0B2925] focus:outline-none focus:ring-1 focus:ring-[#A7F3D0]"
                              required
                            />
                            <button
                              type="button"
                              onClick={() => setShowSignUpConfirm(!showSignUpConfirm)}
                              className="absolute right-3 top-2.5 text-[#755B73] hover:text-[#0B2925]"
                            >
                              {showSignUpConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                          {signUpFieldErrors.confirmPassword?.[0] && (
                            <p className="mt-1 text-[11px] font-medium text-red-600">
                              {signUpFieldErrors.confirmPassword[0]}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Live Password Strength Meter */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="font-semibold text-[#755B73]">Password strength:</span>
                          <span
                            className={`font-bold ${
                              signUpPasswordStrength.score <= 2
                                ? "text-red-500"
                                : signUpPasswordStrength.score <= 4
                                  ? "text-amber-600"
                                  : "text-[#0B2925]"
                            }`}
                          >
                            {signUpPasswordStrength.label}
                          </span>
                        </div>
                        <Progress
                          value={signUpPasswordStrength.percent}
                          className="h-1.5 bg-[#E5DDD8] [&_[data-slot=progress-indicator]]:bg-[#A7F3D0]"
                        />
                      </div>

                      {/* Password Rules Checklist */}
                      <div className="rounded-xl bg-[#F8F5F3] p-2.5 border border-[#E5DDD8] space-y-1">
                        {passwordRules.map((rule) => {
                          const passed = rule.test(signUpPassword);
                          return (
                            <div key={rule.id} className="flex items-center gap-2 text-[11px]">
                              <CheckCircle2
                                className={`h-3.5 w-3.5 transition-colors ${
                                  passed ? "text-[#0B2925]" : "text-[#755B73]/40"
                                }`}
                              />
                              <span className={passed ? "text-[#0B2925] font-semibold" : "text-[#755B73]"}>
                                {rule.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Submit button */}
                      <Button
                        type="submit"
                        disabled={isSigningUp}
                        className="w-full mt-2 h-11 bg-[#0B2925] text-white text-xs font-bold rounded-xl shadow-md hover:bg-[#133D37] disabled:opacity-50"
                      >
                        {isSigningUp ? (
                          <span className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin text-[#A7F3D0]" /> Creating Account...
                          </span>
                        ) : (
                          "Create Secure Account"
                        )}
                      </Button>
                    </form>
                  </motion.div>
                )}

                {/* 3. FORGOT PASSWORD VIEW (3-Step Verified Reset) */}
                {activeTab === "forgot_password" && (
                  <motion.div
                    key="forgot"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="flex items-center justify-between">
                      <p className="eyebrow text-[#755B73]">Verified recovery</p>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab("signin");
                          setSignInError("");
                          setSignInFieldErrors({});
                          setForgotError("");
                          setForgotSuccessMessage("");
                        }}
                        className="text-xs font-bold text-[#0B2925] hover:underline"
                      >
                        ← Back to Sign In
                      </button>
                    </div>

                    <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-[#27212B]">
                      Reset Your Password
                    </h2>

                    {/* Stepper with small progress indicator */}
                    {forgotStep !== "success" && (
                      <div className="mt-3 mb-4 rounded-xl border border-[#E5DDD8] bg-[#F8F5F3] px-3 py-2.5">
                        <div className="flex items-center justify-between text-[11px] font-bold text-[#755B73]">
                          {/* Step 1 Indicator */}
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold transition-colors ${
                                forgotStep === 1
                                  ? "bg-[#0B2925] text-white"
                                  : forgotStep > 1
                                    ? "bg-[#A7F3D0] text-[#0B2925]"
                                    : "bg-[#E5DDD8] text-[#755B73]"
                              }`}
                            >
                              {forgotStep > 1 ? "✓" : "1"}
                            </span>
                            <span className={forgotStep === 1 ? "text-[#0B2925] font-bold" : ""}>Email</span>
                          </div>

                          <div
                            className={`h-[2px] flex-1 mx-2 transition-colors ${
                              forgotStep > 1 ? "bg-[#A7F3D0]" : "bg-[#E5DDD8]"
                            }`}
                          />

                          {/* Step 2 Indicator */}
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold transition-colors ${
                                forgotStep === 2
                                  ? "bg-[#0B2925] text-white"
                                  : forgotStep > 2
                                    ? "bg-[#A7F3D0] text-[#0B2925]"
                                    : "bg-[#E5DDD8] text-[#755B73]"
                              }`}
                            >
                              {forgotStep > 2 ? "✓" : "2"}
                            </span>
                            <span className={forgotStep === 2 ? "text-[#0B2925] font-bold" : ""}>Verify Code</span>
                          </div>

                          <div
                            className={`h-[2px] flex-1 mx-2 transition-colors ${
                              forgotStep === 3 ? "bg-[#A7F3D0]" : "bg-[#E5DDD8]"
                            }`}
                          />

                          {/* Step 3 Indicator */}
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold transition-colors ${
                                forgotStep === 3
                                  ? "bg-[#0B2925] text-white"
                                  : "bg-[#E5DDD8] text-[#755B73]"
                              }`}
                            >
                              3
                            </span>
                            <span className={forgotStep === 3 ? "text-[#0B2925] font-bold" : ""}>New Password</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {forgotError && (
                      <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 font-medium flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
                        <span>{forgotError}</span>
                      </div>
                    )}

                    <AnimatePresence mode="wait" custom={slideDirection}>
                      {/* ── STEP 1: Enter Email ── */}
                      {forgotStep === 1 && (
                        <motion.form
                          key="step1"
                          custom={slideDirection}
                          initial={{ opacity: 0, x: slideDirection > 0 ? 20 : -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: slideDirection > 0 ? -20 : 20 }}
                          transition={{ duration: 0.2 }}
                          onSubmit={handleSendVerificationCode}
                          className="mt-4 space-y-4"
                        >
                          <p className="text-xs leading-5 text-[#524458]">
                            Enter your registered email address. We will generate a secure, short-lived 6-digit verification code to verify your identity.
                          </p>

                          <div>
                            <label className="block text-xs font-bold text-[#27212B] mb-1">
                              Registered Email Address
                            </label>
                            <div className="relative">
                              <Mail className="absolute left-3 top-3 h-4 w-4 text-[#755B73]" />
                              <input
                                type="email"
                                value={forgotEmail}
                                onChange={(e) => {
                                  setForgotEmail(e.target.value);
                                  if (forgotFieldErrors.email) {
                                    setForgotFieldErrors((prev) => ({ ...prev, email: [] }));
                                  }
                                }}
                                placeholder="you@domain.com"
                                className="w-full rounded-xl border border-[#E5DDD8] bg-[#F8F5F3] pl-9 pr-4 py-2.5 text-xs text-[#27212B] focus:border-[#0B2925] focus:outline-none focus:ring-1 focus:ring-[#A7F3D0]"
                                required
                              />
                            </div>
                            {forgotFieldErrors.email?.[0] && (
                              <p className="mt-1 text-[11px] font-medium text-red-600">
                                {forgotFieldErrors.email[0]}
                              </p>
                            )}
                          </div>

                          <Button
                            type="submit"
                            disabled={isForgotLoading}
                            className="w-full h-11 bg-[#0B2925] text-white text-xs font-bold rounded-xl shadow-md hover:bg-[#133D37] disabled:opacity-50"
                          >
                            {isForgotLoading ? (
                              <span className="flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin text-[#A7F3D0]" /> Sending verification code...
                              </span>
                            ) : (
                              "Send verification code"
                            )}
                          </Button>
                        </motion.form>
                      )}

                      {/* ── STEP 2: Enter OTP Code (+ Optional 2FA) ── */}
                      {forgotStep === 2 && (
                        <motion.form
                          key="step2"
                          custom={slideDirection}
                          initial={{ opacity: 0, x: slideDirection > 0 ? 20 : -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: slideDirection > 0 ? -20 : 20 }}
                          transition={{ duration: 0.2 }}
                          onSubmit={handleVerifyResetOtp}
                          className="mt-4 space-y-4"
                        >
                          {/* Neutral notification always displayed */}
                          <div className="rounded-xl border border-[#A7F3D0]/60 bg-[#A7F3D0]/10 p-3 text-xs text-[#0B2925] flex items-start gap-2.5">
                            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-[#0B2925]" />
                            <div>
                              <p className="font-bold">If that email exists, we've sent a code.</p>
                              <p className="mt-0.5 text-[11px] text-[#524458]">
                                Please check your inbox for the 6-digit code sent to <strong className="text-[#0B2925]">{forgotEmail}</strong>.
                              </p>
                            </div>
                          </div>

                          {/* 6-Digit Email OTP Input */}
                          <div className="flex flex-col items-center justify-center space-y-2 py-1">
                            <label className="text-xs font-bold text-[#27212B]">
                              Enter 6-digit verification code
                            </label>
                            <InputOTP
                              maxLength={6}
                              value={otpCode}
                              onChange={(v) => {
                                setOtpCode(v);
                                setForgotError("");
                              }}
                            >
                              <InputOTPGroup>
                                <InputOTPSlot index={0} />
                                <InputOTPSlot index={1} />
                                <InputOTPSlot index={2} />
                              </InputOTPGroup>
                              <InputOTPSeparator />
                              <InputOTPGroup>
                                <InputOTPSlot index={3} />
                                <InputOTPSlot index={4} />
                                <InputOTPSlot index={5} />
                              </InputOTPGroup>
                            </InputOTP>
                          </div>

                          {/* Countdown Timer & Remaining Attempts Hint */}
                          <div className="flex items-center justify-between rounded-xl border border-[#E5DDD8] bg-[#F8F5F3] px-3.5 py-2 text-[11px]">
                            <div className="flex items-center gap-1.5 font-semibold">
                              <Clock className={`h-3.5 w-3.5 ${otpCountdown < 60 ? "text-red-500" : "text-[#755B73]"}`} />
                              <span className={otpCountdown < 60 ? "text-red-600 font-bold" : "text-[#755B73]"}>
                                {otpCountdown > 0 ? `Code expires in ${formatCountdown(otpCountdown)}` : "Code expired"}
                              </span>
                            </div>
                            <span className="font-bold text-[#524458]">
                              {remainingAttempts} attempt{remainingAttempts !== 1 ? "s" : ""} remaining
                            </span>
                          </div>

                          {/* Resend Code Button */}
                          <div className="flex items-center justify-between pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setSlideDirection(-1);
                                setForgotStep(1);
                              }}
                              className="text-xs font-semibold text-[#755B73] hover:text-[#0B2925]"
                            >
                              ← Change email
                            </button>
                            <button
                              type="button"
                              disabled={resendCountdown > 0 || isForgotLoading}
                              onClick={handleResendCode}
                              className="text-xs font-bold text-[#0B2925] hover:underline disabled:text-[#755B73] disabled:no-underline disabled:cursor-not-allowed flex items-center gap-1"
                            >
                              <RefreshCw className={`h-3 w-3 ${isForgotLoading ? "animate-spin" : ""}`} />
                              {resendCountdown > 0 ? `Resend code (${resendCountdown}s)` : "Resend code"}
                            </button>
                          </div>

                          {/* Second InputOTP: Authenticator App Code (if 2FA enabled) */}
                          {requires2fa && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              className="rounded-xl border border-[#0B2925]/20 bg-[#F8F5F3] p-3.5 space-y-2"
                            >
                              <div className="flex items-center gap-2 text-[#0B2925]">
                                <ShieldCheck className="h-4 w-4 shrink-0 text-[#0B2925]" />
                                <label className="text-xs font-bold text-[#27212B]">
                                  Authenticator app code
                                </label>
                              </div>
                              <p className="text-[11px] text-[#524458]">
                                Two-Factor Authentication is active on this account. Enter the 6-digit code from your authenticator app or an emergency recovery code.
                              </p>
                              <div className="flex justify-center pt-1">
                                <InputOTP
                                  maxLength={6}
                                  value={totpCode}
                                  onChange={(v) => {
                                    setTotpCode(v);
                                    setForgotError("");
                                  }}
                                >
                                  <InputOTPGroup>
                                    <InputOTPSlot index={0} />
                                    <InputOTPSlot index={1} />
                                    <InputOTPSlot index={2} />
                                  </InputOTPGroup>
                                  <InputOTPSeparator />
                                  <InputOTPGroup>
                                    <InputOTPSlot index={3} />
                                    <InputOTPSlot index={4} />
                                    <InputOTPSlot index={5} />
                                  </InputOTPGroup>
                                </InputOTP>
                              </div>
                            </motion.div>
                          )}

                          <Button
                            type="submit"
                            disabled={
                              isForgotLoading ||
                              otpCode.length !== 6 ||
                              otpCountdown <= 0 ||
                              remainingAttempts <= 0 ||
                              (requires2fa && totpCode.length !== 6)
                            }
                            className="w-full h-11 bg-[#0B2925] text-white text-xs font-bold rounded-xl shadow-md hover:bg-[#133D37] disabled:opacity-50"
                          >
                            {isForgotLoading ? (
                              <span className="flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin text-[#A7F3D0]" /> Verifying code...
                              </span>
                            ) : (
                              "Verify code & proceed"
                            )}
                          </Button>
                        </motion.form>
                      )}

                      {/* ── STEP 3: Enter New Password ── */}
                      {forgotStep === 3 && (
                        <motion.form
                          key="step3"
                          custom={slideDirection}
                          initial={{ opacity: 0, x: slideDirection > 0 ? 20 : -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: slideDirection > 0 ? -20 : 20 }}
                          transition={{ duration: 0.2 }}
                          onSubmit={handleResetPassword}
                          className="mt-4 space-y-3.5"
                        >
                          <p className="text-xs leading-5 text-[#524458]">
                            Identity verified. Choose a strong new password that differs from your previous password.
                          </p>

                          <div>
                            <label className="block text-xs font-bold text-[#27212B] mb-1">New Password</label>
                            <div className="relative">
                              <Lock className="absolute left-3 top-3 h-4 w-4 text-[#755B73]" />
                              <input
                                type={showNewPassword ? "text" : "password"}
                                value={newPassword}
                                onChange={(e) => {
                                  setNewPassword(e.target.value);
                                  if (forgotFieldErrors.newPassword) {
                                    setForgotFieldErrors((prev) => ({ ...prev, newPassword: [] }));
                                  }
                                }}
                                placeholder="Min 8 chars, 1 upper..."
                                className="w-full rounded-xl border border-[#E5DDD8] bg-[#F8F5F3] pl-9 pr-10 py-2.5 text-xs text-[#27212B] focus:border-[#0B2925] focus:outline-none focus:ring-1 focus:ring-[#A7F3D0]"
                                required
                              />
                              <button
                                type="button"
                                onClick={() => setShowNewPassword(!showNewPassword)}
                                className="absolute right-3 top-3 text-[#755B73] hover:text-[#0B2925]"
                              >
                                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                            {forgotFieldErrors.newPassword?.[0] && (
                              <p className="mt-1 text-[11px] font-medium text-red-600">
                                {forgotFieldErrors.newPassword[0]}
                              </p>
                            )}
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-[#27212B] mb-1">
                              Confirm New Password
                            </label>
                            <div className="relative">
                              <Lock className="absolute left-3 top-3 h-4 w-4 text-[#755B73]" />
                              <input
                                type={showConfirmNewPassword ? "text" : "password"}
                                value={confirmNewPassword}
                                onChange={(e) => {
                                  setConfirmNewPassword(e.target.value);
                                  if (forgotFieldErrors.confirmNewPassword) {
                                    setForgotFieldErrors((prev) => ({ ...prev, confirmNewPassword: [] }));
                                  }
                                }}
                                placeholder="Repeat new password"
                                className="w-full rounded-xl border border-[#E5DDD8] bg-[#F8F5F3] pl-9 pr-10 py-2.5 text-xs text-[#27212B] focus:border-[#0B2925] focus:outline-none focus:ring-1 focus:ring-[#A7F3D0]"
                                required
                              />
                              <button
                                type="button"
                                onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                                className="absolute right-3 top-3 text-[#755B73] hover:text-[#0B2925]"
                              >
                                {showConfirmNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                            {forgotFieldErrors.confirmNewPassword?.[0] && (
                              <p className="mt-1 text-[11px] font-medium text-red-600">
                                {forgotFieldErrors.confirmNewPassword[0]}
                              </p>
                            )}
                          </div>

                          {/* Live Password Strength Meter */}
                          <div className="space-y-1.5 pt-1">
                            <div className="flex justify-between items-center text-[11px]">
                              <span className="font-semibold text-[#755B73]">Password strength:</span>
                              <span
                                className={`font-bold ${
                                  resetPasswordStrength.score <= 2
                                    ? "text-red-500"
                                    : resetPasswordStrength.score <= 4
                                      ? "text-amber-600"
                                      : "text-[#0B2925]"
                                }`}
                              >
                                {resetPasswordStrength.label}
                              </span>
                            </div>
                            <Progress
                              value={resetPasswordStrength.percent}
                              className="h-1.5 bg-[#E5DDD8] [&_[data-slot=progress-indicator]]:bg-[#A7F3D0]"
                            />
                          </div>

                          {/* Password Rules Checklist */}
                          <div className="rounded-xl bg-[#F8F5F3] p-2.5 border border-[#E5DDD8] space-y-1">
                            {passwordRules.map((rule) => {
                              const passed = rule.test(newPassword);
                              return (
                                <div key={rule.id} className="flex items-center gap-2 text-[11px]">
                                  <CheckCircle2
                                    className={`h-3.5 w-3.5 transition-colors ${
                                      passed ? "text-[#0B2925]" : "text-[#755B73]/40"
                                    }`}
                                  />
                                  <span className={passed ? "text-[#0B2925] font-semibold" : "text-[#755B73]"}>
                                    {rule.label}
                                  </span>
                                </div>
                              );
                            })}
                          </div>

                          <Button
                            type="submit"
                            disabled={isForgotLoading}
                            className="w-full h-11 bg-[#0B2925] text-white text-xs font-bold rounded-xl shadow-md hover:bg-[#133D37] disabled:opacity-50"
                          >
                            {isForgotLoading ? (
                              <span className="flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin text-[#A7F3D0]" /> Updating Password...
                              </span>
                            ) : (
                              "Save New Password"
                            )}
                          </Button>
                        </motion.form>
                      )}

                      {/* ── SUCCESS STATE ── */}
                      {forgotStep === "success" && (
                        <motion.div
                          key="success"
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.25 }}
                          className="mt-6 text-center py-4 space-y-4"
                        >
                          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#A7F3D0] bg-[#A7F3D0]/30 text-[#0B2925]">
                            <CheckCircle2 className="h-8 w-8 text-[#0B2925]" />
                          </div>

                          <div>
                            <h3 className="font-display text-xl font-extrabold text-[#27212B]">
                              Password updated. Please sign in.
                            </h3>
                            <p className="mt-1 text-xs text-[#755B73] max-w-sm mx-auto">
                              Your password has been successfully updated. All active sessions have been terminated for security.
                            </p>
                          </div>

                          <Button
                            type="button"
                            onClick={() => {
                              setSignInEmail(forgotEmail);
                              setSignInPassword("");
                              setForgotStep(1);
                              setForgotEmail("");
                              setOtpCode("");
                              setTotpCode("");
                              setResetToken("");
                              setNewPassword("");
                              setConfirmNewPassword("");
                              setForgotError("");
                              setForgotSuccessMessage("");
                              setActiveTab("signin");
                            }}
                            className="w-full h-11 bg-[#0B2925] text-white text-xs font-bold rounded-xl shadow-md hover:bg-[#133D37]"
                          >
                            Back to Sign In
                          </Button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}

                {/* 4. VERIFY EMAIL VIEW */}
                {activeTab === "verify_email" && (
                  <motion.div
                    key="verify_email"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="flex items-center justify-between">
                      <p className="eyebrow text-[#755B73]">Account Activation</p>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab("signup");
                          setLocation("/access?mode=signup");
                          setSignUpError("");
                          setSignUpFieldErrors({});
                        }}
                        className="text-xs font-bold text-[#0B2925] hover:underline"
                      >
                        ← Use a different email
                      </button>
                    </div>

                    <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-[#27212B]">
                      Verify your email
                    </h2>

                    {isVerifySuccess ? (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.25 }}
                        className="mt-6 text-center py-6 space-y-4"
                      >
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#A7F3D0] bg-[#A7F3D0]/30 text-[#0B2925]">
                          <CheckCircle2 className="h-8 w-8 text-[#0B2925]" />
                        </div>
                        <div>
                          <h3 className="font-display text-xl font-extrabold text-[#27212B]">
                            Email verified
                          </h3>
                          <p className="mt-1 text-xs text-[#755B73] max-w-sm mx-auto">
                            Your account is now activated. Welcome to SecureAuth! Redirecting to your dashboard...
                          </p>
                        </div>
                      </motion.div>
                    ) : (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (verifyCode.length === 6) {
                            void executeVerify(verifyCode);
                          }
                        }}
                        className="mt-4 space-y-4"
                      >
                        <p className="text-xs leading-5 text-[#524458]">
                          We sent a 6-digit code to{" "}
                          <strong className="text-[#0B2925] font-bold">
                            {verifyEmail || "your email address"}
                          </strong>
                          .
                        </p>

                        {/* Info Message (e.g. from unverified login redirect) */}
                        {verifyInfo && (
                          <div className="rounded-xl border border-[#A7F3D0]/60 bg-[#A7F3D0]/10 p-3 text-xs text-[#0B2925] flex items-start gap-2.5">
                            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-[#0B2925]" />
                            <span className="font-medium">{verifyInfo}</span>
                          </div>
                        )}

                        {/* Error Box for wrong or expired code */}
                        {verifyError && (
                          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 font-medium flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
                            <span>{verifyError}</span>
                          </div>
                        )}

                        {/* 6-Digit Email OTP Input with auto-submit */}
                        <div className="flex flex-col items-center justify-center space-y-2 py-1">
                          <label className="text-xs font-bold text-[#27212B]">
                            Enter 6-digit verification code
                          </label>
                          <InputOTP
                            maxLength={6}
                            value={verifyCode}
                            onChange={(v) => {
                              setVerifyCode(v);
                              setVerifyError("");
                              setVerifyInfo("");
                              if (v.length === 6 && !isVerifying) {
                                void executeVerify(v);
                              }
                            }}
                            disabled={isVerifying || isVerifySuccess}
                          >
                            <InputOTPGroup>
                              <InputOTPSlot index={0} />
                              <InputOTPSlot index={1} />
                              <InputOTPSlot index={2} />
                            </InputOTPGroup>
                            <InputOTPSeparator />
                            <InputOTPGroup>
                              <InputOTPSlot index={3} />
                              <InputOTPSlot index={4} />
                              <InputOTPSlot index={5} />
                            </InputOTPGroup>
                          </InputOTP>
                        </div>

                        {/* Countdown Timer & Remaining Attempts Hint */}
                        <div className="flex items-center justify-between rounded-xl border border-[#E5DDD8] bg-[#F8F5F3] px-3.5 py-2 text-[11px]">
                          <div className="flex items-center gap-1.5 font-semibold">
                            <Clock
                              className={`h-3.5 w-3.5 ${
                                verifyCountdown < 60 ? "text-red-500" : "text-[#755B73]"
                              }`}
                            />
                            <span
                              className={
                                verifyCountdown < 60 ? "text-red-600 font-bold" : "text-[#755B73]"
                              }
                            >
                              {verifyCountdown > 0
                                ? `Code expires in ${formatCountdown(verifyCountdown)}`
                                : "Code expired"}
                            </span>
                          </div>
                          <span className="font-bold text-[#524458]">
                            {verifyRemainingAttempts} attempt
                            {verifyRemainingAttempts !== 1 ? "s" : ""} remaining
                          </span>
                        </div>

                        {/* Resend Code & Different Email Controls */}
                        <div className="flex items-center justify-between pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTab("signup");
                              setLocation("/access?mode=signup");
                              setSignUpError("");
                              setSignUpFieldErrors({});
                            }}
                            className="text-xs font-semibold text-[#755B73] hover:text-[#0B2925]"
                          >
                            ← Use a different email
                          </button>
                          <button
                            type="button"
                            disabled={
                              verifyResendCountdown > 0 || isResendingVerification || isVerifying
                            }
                            onClick={handleResendVerification}
                            className="text-xs font-bold text-[#0B2925] hover:underline disabled:text-[#755B73] disabled:no-underline disabled:cursor-not-allowed flex items-center gap-1"
                          >
                            <RefreshCw
                              className={`h-3 w-3 ${
                                isResendingVerification ? "animate-spin" : ""
                              }`}
                            />
                            {verifyResendCountdown > 0
                              ? `Resend code (${verifyResendCountdown}s)`
                              : "Resend code"}
                          </button>
                        </div>

                        {/* Verify Button with loading spinner */}
                        <Button
                          type="submit"
                          disabled={
                            isVerifying ||
                            verifyCode.length !== 6 ||
                            verifyCountdown <= 0 ||
                            verifyRemainingAttempts <= 0
                          }
                          className="w-full h-11 bg-[#0B2925] text-white text-xs font-bold rounded-xl shadow-md hover:bg-[#133D37] disabled:opacity-50"
                        >
                          {isVerifying ? (
                            <span className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin text-[#A7F3D0]" /> Verifying...
                            </span>
                          ) : (
                            "Verify"
                          )}
                        </Button>
                      </form>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
