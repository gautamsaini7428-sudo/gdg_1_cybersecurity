/**
 * /api/auth route handlers
 *
 * Routes
 * ──────
 *   GET  /csrf-token           → issue a CSRF token (must be called before any POST)
 *   POST /register             → create account + send verify-email code
 *   POST /verify-email         → submit 6-digit verification code to activate account
 *   POST /resend-verify        → resend the verification code (rate-limited, 60 s cooldown)
 *   POST /login                → authenticate + email-verified gate + 2FA + session
 *   POST /logout               → destroy session (requires auth + CSRF)
 *   GET  /me                   → current session info (requires auth)
 *   GET  /activity             → login event log (requires auth)
 *   POST /forgot-password      → creates 6-digit OTP, neutral message
 *   POST /verify-reset-otp     → validates OTP (+ TOTP if 2FA enabled), returns resetToken
 *   POST /reset-password       → validates resetToken, sets new password, revokes all sessions
 *   POST /2fa/setup            → generates TOTP secret + QR code
 *   POST /2fa/enable           → confirms first code, generates recovery codes
 *   POST /2fa/disable          → disables 2FA (requires password + code)
 */

import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { v4 as uuidv4 } from "uuid";
import { generateSecret, generateURI, verifySync } from "otplib";
import qrcode from "qrcode";
import { z } from "zod";

import { AUTH_CONFIG } from "../../../shared/const.js";
import {
  registerSchema,
  loginSchema,
  verifyResetOtpSchema,
  resetPasswordWithTokenSchema,
  enable2faSchema,
  disable2faSchema,
} from "../../../shared/validation.js";
import {
  userRepo,
  resetOtpRepo,
  resetTokenRepo,
  activityRepo,
  emailVerificationRepo,
  toPublicUser,
} from "../repository.js";
import {
  hashPassword,
  verifyPassword,
  dummyVerify,
  generateResetOtp,
  hashOtp,
  generateResetToken,
  hashResetToken,
  encryptSecret,
  decryptSecret,
  generateRecoveryCodes,
  verifyRecoveryCode,
} from "../crypto.js";
import { requireAuth } from "../middleware/auth.js";
import { generateToken, doubleCsrfProtection } from "../middleware/csrf.js";
import { getClientIp } from "../utils/ip.js";
import { sendMail } from "../services/emailService.js";

const router = Router();

// ── Constants ─────────────────────────────────────────────────────────────────

/** Expiry for email verification codes: 10 minutes */
const EMAIL_VERIFY_EXPIRY_MINUTES = 10;
/** Max OTP verify attempts before invalidation */
const EMAIL_VERIFY_MAX_ATTEMPTS = 5;
/** Resend cooldown in ms (60 seconds) */
const RESEND_COOLDOWN_MS = 60_000;

// ── Rate limiters ─────────────────────────────────────────────────────────────

/** IP-level limiter applied to all auth routes */
const authLimiter = rateLimit({
  windowMs: AUTH_CONFIG.RATE_LIMIT_WINDOW_MS,
  max: AUTH_CONFIG.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  skip: () => process.env.NODE_ENV === "test",
  message: {
    success: false,
    message: "Too many requests from this IP. Please try again later.",
  },
});

/** Tighter limit on registration (5 per hour per IP) */
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
  message: {
    success: false,
    message: "Too many registration attempts. Please try again later.",
  },
});

/** Tighter limit on forgot-password (5 per 15 min per IP) */
const forgotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
  message: {
    success: false,
    message: "Too many reset requests. Please try again later.",
  },
});

/** Resend-verify: 3 requests per 5 minutes per IP */
const resendVerifyLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
  message: {
    success: false,
    message: "Too many resend requests. Please wait before trying again.",
  },
});

// ── Generic messages — never leak user existence ──────────────────────────────

const INVALID_CREDENTIALS = "Invalid email or password.";
const ACCOUNT_LOCKED = (seconds: number) =>
  `Account temporarily locked. Try again in ${Math.ceil(seconds / 60)} minute(s).`;
const SAFE_RESET_MSG = "If that email exists, we've sent a code.";
const EMAIL_UNVERIFIED_MSG =
  "Please verify your email address before signing in. Check your inbox for a verification code.";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Issues a fresh email verification code for `userId`, stores it, and fires
 * the verifyEmail email asynchronously. Safe to call for both new registrations
 * and resends.
 */
async function issueEmailVerificationCode(userId: string, email: string): Promise<void> {
  const rawCode = generateResetOtp(); // reuse the 6-digit CSPRNG
  const codeHash = hashOtp(rawCode);
  const expiresAt = Date.now() + EMAIL_VERIFY_EXPIRY_MINUTES * 60 * 1000;

  emailVerificationRepo.create(uuidv4(), userId, codeHash, expiresAt);

  void sendMail({
    to: email,
    subject: "Confirm your SecureAuth email address",
    template: "verifyEmail",
    data: { code: rawCode, minutesValid: EMAIL_VERIFY_EXPIRY_MINUTES },
  });

  if (process.env.NODE_ENV === "development") {
    console.info(
      `\n[DEV] 📧 Email verification code for ${email}: ${rawCode} (expires in ${EMAIL_VERIFY_EXPIRY_MINUTES} min)\n`
    );
  }
}

// ── GET /csrf-token ───────────────────────────────────────────────────────────

router.get("/csrf-token", (req: Request, res: Response): void => {
  const token = generateToken(req, res);
  res.json({ csrfToken: token });
});

// ── POST /register ────────────────────────────────────────────────────────────

router.post(
  "/register",
  registerLimiter,
  doubleCsrfProtection,
  async (req: Request, res: Response): Promise<void> => {
    // 1. Validate input against the shared Zod schema
    const parsed = registerSchema.safeParse({
      ...req.body,
      confirmPassword: req.body.confirmPassword ?? req.body.password,
    });
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Validation failed.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const { name, email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    // 2. Check for duplicate email — always use a generic message
    if (userRepo.emailExists(normalizedEmail)) {
      res.status(409).json({
        success: false,
        message: "An account with this email already exists. Please sign in.",
      });
      return;
    }

    // 3. Hash password with Argon2id (or bcrypt fallback)
    const passwordHash = await hashPassword(password);
    const now = new Date().toISOString();
    const userId = uuidv4();

    const newUser = userRepo.create({
      id: userId,
      name,
      email: normalizedEmail,
      passwordHash,
      createdAt: now,
    });

    // 4. Issue email verification code (async, never blocks response)
    await issueEmailVerificationCode(newUser.id, newUser.email);

    // 5. DO NOT establish a session yet — user must verify email first.
    activityRepo.record({
      id: uuidv4(),
      userId: newUser.id,
      timestamp: now,
      ip: getClientIp(req),
      userAgent: req.headers["user-agent"] ?? "unknown",
      success: true,
      failureReason: "Registration — awaiting email verification",
    });

    res.status(201).json({
      success: true,
      emailVerificationRequired: true,
      message:
        "Account created. Please check your email for a 6-digit verification code to activate your account.",
      user: toPublicUser(newUser),
    });
  }
);

// ── POST /verify-email ────────────────────────────────────────────────────────

router.post(
  "/verify-email",
  authLimiter,
  doubleCsrfProtection,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = z
      .object({
        email: z.string().trim().email(),
        code: z.string().trim().length(6).regex(/^\d{6}$/),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Invalid email or verification code format.",
      });
      return;
    }

    const { email, code } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();
    const user = userRepo.findByEmail(normalizedEmail);

    if (!user) {
      res.status(400).json({
        success: false,
        message: "Invalid or expired verification code.",
      });
      return;
    }

    if (user.email_verified === 1) {
      // If already verified, establish session directly
      req.session.regenerate((err) => {
        if (err) {
          res.status(500).json({ success: false, message: "Session error." });
          return;
        }
        req.session.userId = user.id;
        req.session.sessionVersion = user.session_version ?? 1;
        req.session.createdAt = Date.now();
        res.status(200).json({
          success: true,
          message: "Email already verified. Welcome to SecureAuth!",
          user: toPublicUser(user),
        });
      });
      return;
    }

    const activeVer = emailVerificationRepo.getLatestActive(user.id);
    if (!activeVer) {
      res.status(400).json({
        success: false,
        message: "No active verification code found. Please request a new one.",
      });
      return;
    }

    if (Date.now() > activeVer.expires_at) {
      emailVerificationRepo.invalidate(activeVer.id);
      res.status(400).json({
        success: false,
        message: "Verification code has expired. Please request a new one.",
        remainingAttempts: 0,
      });
      return;
    }

    if (activeVer.attempts >= EMAIL_VERIFY_MAX_ATTEMPTS) {
      emailVerificationRepo.invalidate(activeVer.id);
      res.status(400).json({
        success: false,
        message: "Too many failed attempts. This verification code has been invalidated. Please request a new one.",
        remainingAttempts: 0,
      });
      return;
    }

    const inputHash = hashOtp(code);
    if (inputHash !== activeVer.code_hash) {
      emailVerificationRepo.incrementAttempts(activeVer.id);
      const attempts = activeVer.attempts + 1;
      const remaining = EMAIL_VERIFY_MAX_ATTEMPTS - attempts;

      if (remaining <= 0) {
        emailVerificationRepo.invalidate(activeVer.id);
        res.status(400).json({
          success: false,
          message: "Too many failed attempts. This verification code has been invalidated. Please request a new one.",
          remainingAttempts: 0,
        });
        return;
      }

      res.status(400).json({
        success: false,
        message: `Invalid code. ${remaining} attempt(s) remaining.`,
        remainingAttempts: remaining,
      });
      return;
    }

    // Code is correct — verify the user and consume code (single use)
    emailVerificationRepo.consume(activeVer.id);
    userRepo.markEmailVerified(user.id);

    const verifiedUser = userRepo.findById(user.id)!;

    // Establish session
    req.session.regenerate((err) => {
      if (err) {
        res.status(500).json({ success: false, message: "Session error." });
        return;
      }
      req.session.userId = verifiedUser.id;
      req.session.sessionVersion = verifiedUser.session_version ?? 1;
      req.session.createdAt = Date.now();

      activityRepo.record({
        id: uuidv4(),
        userId: verifiedUser.id,
        timestamp: new Date().toISOString(),
        ip: getClientIp(req),
        userAgent: req.headers["user-agent"] ?? "unknown",
        success: true,
        failureReason: "Email verified",
      });

      res.status(200).json({
        success: true,
        message: "Email verified. Welcome to SecureAuth!",
        user: toPublicUser(verifiedUser),
      });
    });
  }
);

// ── POST /resend-verification & /resend-verify ────────────────────────────────

const handleResendVerification = async (req: Request, res: Response): Promise<void> => {
  const parsed = z
    .object({ email: z.string().trim().email() })
    .safeParse(req.body);

  // Always return a neutral message — never reveal if email exists
  if (!parsed.success) {
    res.status(200).json({ success: true, message: "If that email exists, we've sent a new code." });
    return;
  }

  const normalizedEmail = parsed.data.email.toLowerCase().trim();
  const user = userRepo.findByEmail(normalizedEmail);

  if (user && user.email_verified === 0) {
    // Enforce a 60-second cooldown based on the existing verification's created_at
    const existing = emailVerificationRepo.getLatestActive(user.id);
    const createdAt = existing ? new Date(existing.created_at).getTime() : 0;
    if (Date.now() - createdAt < RESEND_COOLDOWN_MS) {
      res.status(429).json({
        success: false,
        message: "Please wait 60 seconds before requesting another code.",
        retryAfterSeconds: Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - createdAt)) / 1000),
      });
      return;
    }

    await issueEmailVerificationCode(user.id, user.email);
  }

  res.status(200).json({ success: true, message: "If that email exists, we've sent a new code." });
};

router.post("/resend-verification", resendVerifyLimiter, doubleCsrfProtection, handleResendVerification);
router.post("/resend-verify", resendVerifyLimiter, doubleCsrfProtection, handleResendVerification);

// ── POST /login ───────────────────────────────────────────────────────────────

router.post(
  "/login",
  authLimiter,
  doubleCsrfProtection,
  async (req: Request, res: Response): Promise<void> => {
    // 1. Validate
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: INVALID_CREDENTIALS,
      });
      return;
    }

    const { email, password } = parsed.data;
    const totpInput = typeof req.body.totp === "string" ? req.body.totp.trim() : "";
    const normalizedEmail = email.toLowerCase().trim();
    const ip = getClientIp(req);
    const ua = req.headers["user-agent"] ?? "unknown";
    const now = new Date().toISOString();

    const user = userRepo.findByEmail(normalizedEmail);

    // 2. Constant-time guard — always run the hash comparison
    if (!user) {
      await dummyVerify();
      res.status(401).json({ success: false, message: INVALID_CREDENTIALS });
      return;
    }

    // 3. Per-account lockout check
    if (user.locked_until && Date.now() < user.locked_until) {
      const remaining = user.locked_until - Date.now();
      activityRepo.record({
        id: uuidv4(),
        userId: user.id,
        timestamp: now,
        ip,
        userAgent: ua,
        success: false,
        failureReason: "Account locked",
      });
      res.status(429).json({
        success: false,
        message: ACCOUNT_LOCKED(remaining / 1000),
        retryAfterSeconds: Math.ceil(remaining / 1000),
        lockedUntil: new Date(user.locked_until).toISOString(),
      });
      return;
    }

    // 4. Verify password
    const passwordMatch = await verifyPassword(password, user.password_hash);

    if (!passwordMatch) {
      userRepo.recordFailedAttempt(user);
      activityRepo.record({
        id: uuidv4(),
        userId: user.id,
        timestamp: now,
        ip,
        userAgent: ua,
        success: false,
        failureReason: "Invalid password",
      });

      // Re-fetch to get updated locked_until after increment
      const updated = userRepo.findById(user.id);
      if (updated?.locked_until && Date.now() < updated.locked_until) {
        // Account just got locked — send notification email
        void sendMail({
          to: user.email,
          subject: "SecureAuth: Your account has been temporarily locked",
          template: "accountLocked",
          data: {
            lockedUntil: new Date(updated.locked_until).toLocaleString("en-US", { timeZone: "UTC" }) + " UTC",
            ip,
            failedAttempts: updated.failed_attempts,
          },
        });

        res.status(429).json({
          success: false,
          message: ACCOUNT_LOCKED(AUTH_CONFIG.LOCKOUT_DURATION_MINUTES * 60),
          retryAfterSeconds: AUTH_CONFIG.LOCKOUT_DURATION_MINUTES * 60,
          lockedUntil: new Date(updated.locked_until).toISOString(),
        });
        return;
      }

      res.status(401).json({ success: false, message: INVALID_CREDENTIALS });
      return;
    }

    // 5. Email verification gate
    if (user.email_verified === 0) {
      res.status(403).json({
        success: false,
        code: "EMAIL_NOT_VERIFIED",
        emailVerificationRequired: true,
        message: EMAIL_UNVERIFIED_MSG,
      });
      return;
    }

    // 6. Check Two-Factor Authentication if enabled
    if (user.totp_enabled === 1 && user.totp_secret_encrypted) {
      if (!totpInput) {
        res.status(200).json({
          success: false,
          requires2fa: true,
          message: "Two-factor authentication code required.",
        });
        return;
      }

      const secret = decryptSecret(user.totp_secret_encrypted);
      const isTotpValid = verifySync({ token: totpInput, secret }).valid;
      let isRecoveryValid = false;

      if (!isTotpValid && user.totp_recovery_codes_hash) {
        try {
          const hashes: string[] = JSON.parse(user.totp_recovery_codes_hash);
          const recCheck = verifyRecoveryCode(totpInput, hashes);
          if (recCheck.valid) {
            isRecoveryValid = true;
            userRepo.updateRecoveryCodes(user.id, JSON.stringify(recCheck.remainingHashedCodes));
          }
        } catch {
          // ignore parse error
        }
      }

      if (!isTotpValid && !isRecoveryValid) {
        userRepo.recordFailedAttempt(user);
        activityRepo.record({
          id: uuidv4(),
          userId: user.id,
          timestamp: now,
          ip,
          userAgent: ua,
          success: false,
          failureReason: "Invalid 2FA code",
        });
        res.status(401).json({
          success: false,
          message: "Invalid authenticator code.",
        });
        return;
      }
    }

    // 7. Success — reset counters, regenerate session
    userRepo.markLogin(user.id, now);

    // New-IP / new-device login alert (async, never blocks)
    const { isNew } = userRepo.checkAndAddFingerprint(user, ip, ua as string);
    if (isNew) {
      void sendMail({
        to: user.email,
        subject: "SecureAuth: New sign-in detected",
        template: "newLoginAlert",
        data: { timestamp: now, ip, userAgent: ua as string },
      });
    }

    req.session.regenerate((err) => {
      if (err) {
        res.status(500).json({ success: false, message: "Session error." });
        return;
      }
      req.session.userId = user.id;
      req.session.sessionVersion = user.session_version ?? 1;
      req.session.createdAt = Date.now();

      activityRepo.record({
        id: uuidv4(),
        userId: user.id,
        timestamp: now,
        ip,
        userAgent: ua,
        success: true,
      });

      const fresh = userRepo.findById(user.id);
      res.json({ success: true, user: toPublicUser(fresh ?? user) });
    });
  }
);

// ── POST /logout ──────────────────────────────────────────────────────────────

router.post(
  "/logout",
  requireAuth,
  doubleCsrfProtection,
  (req: Request, res: Response): void => {
    req.session.destroy((err) => {
      if (err) {
        res.status(500).json({ success: false, message: "Could not terminate session." });
        return;
      }
      res.clearCookie(AUTH_CONFIG.COOKIE_NAME);
      res.json({ success: true, message: "Signed out successfully." });
    });
  }
);

// ── GET /me ───────────────────────────────────────────────────────────────────

router.get("/me", requireAuth, (req: Request, res: Response): void => {
  const user = userRepo.findById(req.session.userId!);
  if (!user) {
    req.session.destroy(() => {});
    res.status(401).json({ success: false, message: "Session invalid." });
    return;
  }

  const sessionExpiresAt = req.session.cookie.expires
    ? req.session.cookie.expires.toISOString()
    : null;

  res.json({
    success: true,
    user: toPublicUser(user),
    session: {
      createdAt: req.session.createdAt
        ? new Date(req.session.createdAt).toISOString()
        : null,
      expiresAt: sessionExpiresAt,
    },
  });
});

// ── GET /activity ─────────────────────────────────────────────────────────────

router.get("/activity", requireAuth, (req: Request, res: Response): void => {
  const userId = req.session.userId!;
  const events = activityRepo.forUser(userId, 20);
  const failedLast24h = activityRepo.failedLast24h(userId);

  // Map snake_case DB columns → camelCase API response
  res.json({
    success: true,
    failedLast24h,
    events: events.map((e) => ({
      id: e.id,
      userId: e.user_id,
      timestamp: e.timestamp,
      ip: e.ip,
      userAgent: e.user_agent,
      success: e.success === 1,
      failureReason: e.failure_reason ?? undefined,
    })),
  });
});

// ── POST /forgot-password ─────────────────────────────────────────────────────

router.post(
  "/forgot-password",
  forgotLimiter,
  doubleCsrfProtection,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = z
      .object({ email: z.string().trim().email() })
      .safeParse(req.body);

    // Always return the exact same neutral message — never reveal if email exists
    if (!parsed.success) {
      res.status(200).json({ success: true, message: SAFE_RESET_MSG });
      return;
    }

    const email = parsed.data.email.trim().toLowerCase();
    const user = userRepo.findByEmail(email);

    if (user) {
      const rawOtp = generateResetOtp();
      const otpHash = hashOtp(rawOtp);
      const expiryMs =
        Date.now() + AUTH_CONFIG.RESET_OTP_EXPIRY_MINUTES * 60 * 1000;

      resetOtpRepo.create(uuidv4(), user.id, otpHash, expiryMs);

      // Async fire-and-forget — never awaited, errors logged inside sendMail
      void sendMail({
        to: user.email,
        subject: "Your SecureAuth password reset code",
        template: "resetOtp",
        data: { code: rawOtp, minutesValid: AUTH_CONFIG.RESET_OTP_EXPIRY_MINUTES },
      });

      // Never log the OTP code or the SMTP password in production.
      if (process.env.NODE_ENV === "development") {
        console.info(
          `\n[DEV] 🔑 Password reset verification code for ${user.email}: ${rawOtp} (expires in ${AUTH_CONFIG.RESET_OTP_EXPIRY_MINUTES} min)\n`
        );
      }

      activityRepo.record({
        id: uuidv4(),
        userId: user.id,
        timestamp: new Date().toISOString(),
        ip: getClientIp(req),
        userAgent: req.headers["user-agent"] ?? "unknown",
        success: true,
        failureReason: "Reset OTP requested",
      });
    }

    res.status(200).json({ success: true, message: SAFE_RESET_MSG });
  }
);

// ── POST /verify-reset-otp ────────────────────────────────────────────────────

router.post(
  "/verify-reset-otp",
  authLimiter,
  doubleCsrfProtection,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = verifyResetOtpSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Invalid verification code format. Must be a 6-digit code.",
      });
      return;
    }

    const { email, code, totp } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();
    const user = userRepo.findByEmail(normalizedEmail);

    if (!user) {
      res.status(400).json({
        success: false,
        message: "Invalid or expired verification code.",
      });
      return;
    }

    const activeOtp = resetOtpRepo.getLatestActive(user.id);
    if (!activeOtp || activeOtp.consumed_at) {
      res.status(400).json({
        success: false,
        message: "Invalid or expired verification code.",
      });
      return;
    }

    // Check expiration (10 min)
    if (Date.now() > activeOtp.expires_at) {
      resetOtpRepo.invalidate(activeOtp.id);
      res.status(400).json({
        success: false,
        message: "Verification code has expired. Please request a new one.",
      });
      return;
    }

    // Check attempt lockout (max 5 attempts)
    if (activeOtp.attempts >= AUTH_CONFIG.RESET_OTP_MAX_ATTEMPTS) {
      resetOtpRepo.invalidate(activeOtp.id);
      res.status(400).json({
        success: false,
        message: "Verification code has been invalidated due to too many failed attempts.",
      });
      return;
    }

    // Verify OTP hash
    const inputHash = hashOtp(code);
    if (inputHash !== activeOtp.otp_hash) {
      resetOtpRepo.incrementAttempts(activeOtp.id);
      const attempts = activeOtp.attempts + 1;
      if (attempts >= AUTH_CONFIG.RESET_OTP_MAX_ATTEMPTS) {
        resetOtpRepo.invalidate(activeOtp.id);
        res.status(400).json({
          success: false,
          message: "Too many incorrect attempts. This verification code has been invalidated.",
        });
        return;
      }
      res.status(400).json({
        success: false,
        message: `Invalid verification code. ${AUTH_CONFIG.RESET_OTP_MAX_ATTEMPTS - attempts} attempt(s) remaining.`,
      });
      return;
    }

    // OTP matched! If user has 2FA enabled, check TOTP code
    if (user.totp_enabled === 1 && user.totp_secret_encrypted) {
      if (!totp) {
        res.status(200).json({
          success: false,
          requires2fa: true,
          message: "Authenticator app code required.",
        });
        return;
      }

      const secret = decryptSecret(user.totp_secret_encrypted);
      const isTotpValid = verifySync({ token: totp.trim(), secret }).valid;
      let isRecoveryValid = false;

      if (!isTotpValid && user.totp_recovery_codes_hash) {
        try {
          const hashes: string[] = JSON.parse(user.totp_recovery_codes_hash);
          const recCheck = verifyRecoveryCode(totp, hashes);
          if (recCheck.valid) {
            isRecoveryValid = true;
            userRepo.updateRecoveryCodes(user.id, JSON.stringify(recCheck.remainingHashedCodes));
          }
        } catch {
          // ignore error
        }
      }

      if (!isTotpValid && !isRecoveryValid) {
        res.status(400).json({
          success: false,
          requires2fa: true,
          message: "Invalid authenticator code.",
        });
        return;
      }
    }

    // Consume OTP so it cannot be reused
    resetOtpRepo.consume(activeOtp.id);

    // Issue short-lived, single-use reset token
    const rawResetToken = generateResetToken();
    const tokenHash = hashResetToken(rawResetToken);
    const tokenExpiry = Date.now() + AUTH_CONFIG.RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000;

    resetTokenRepo.create(uuidv4(), user.id, tokenHash, tokenExpiry);

    activityRepo.record({
      id: uuidv4(),
      userId: user.id,
      timestamp: new Date().toISOString(),
      ip: getClientIp(req),
      userAgent: req.headers["user-agent"] ?? "unknown",
      success: true,
      failureReason: "Reset OTP verified",
    });

    res.status(200).json({
      success: true,
      resetToken: rawResetToken,
    });
  }
);

// ── POST /reset-password ──────────────────────────────────────────────────────

router.post(
  "/reset-password",
  doubleCsrfProtection,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = resetPasswordWithTokenSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Invalid password or reset token.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const { resetToken, newPassword } = parsed.data;
    const tokenHash = hashResetToken(resetToken);
    const storedToken = resetTokenRepo.findByHash(tokenHash);

    if (!storedToken || storedToken.consumed_at || Date.now() > storedToken.expires_at) {
      res.status(400).json({
        success: false,
        message: "Invalid or expired reset token.",
      });
      return;
    }

    const user = userRepo.findById(storedToken.user_id);
    if (!user) {
      res.status(400).json({
        success: false,
        message: "Invalid reset token.",
      });
      return;
    }

    // OWASP & Requirement: "New password must not equal the current one."
    const isSamePassword = await verifyPassword(newPassword, user.password_hash);
    if (isSamePassword) {
      res.status(400).json({
        success: false,
        message: "New password cannot be the same as your current password.",
      });
      return;
    }

    const newHash = await hashPassword(newPassword);
    const ip = getClientIp(req);
    const changedAt = new Date().toISOString();

    // Update password, increment session_version to revoke all active sessions
    userRepo.updatePasswordAndRevoke(user.id, newHash);
    resetTokenRepo.consume(storedToken.id);

    // Destroy active session on the current client if any
    if (req.session) {
      req.session.destroy(() => {});
    }

    // Notify the user of the change (async, never blocks response)
    void sendMail({
      to: user.email,
      subject: "SecureAuth: Your password has been changed",
      template: "passwordChanged",
      data: {
        changedAt: new Date(changedAt).toLocaleString("en-US", { timeZone: "UTC" }) + " UTC",
        ip,
      },
    });

    activityRepo.record({
      id: uuidv4(),
      userId: user.id,
      timestamp: changedAt,
      ip,
      userAgent: req.headers["user-agent"] ?? "unknown",
      success: true,
      failureReason: "Password reset completed (all sessions revoked)",
    });

    res.status(200).json({
      success: true,
      message: "Password updated successfully. Please sign in.",
    });
  }
);

// ── Two-Factor Authentication (TOTP) Endpoints ────────────────────────────────

// POST /api/auth/2fa/setup
router.post(
  "/2fa/setup",
  requireAuth,
  doubleCsrfProtection,
  async (req: Request, res: Response): Promise<void> => {
    const user = userRepo.findById(req.session.userId!);
    if (!user) {
      res.status(401).json({ success: false, message: "User not found." });
      return;
    }

    const secret = generateSecret();
    const otpauthUrl = generateURI({ secret, issuer: "SecureAuth", label: user.email });
    const qrCode = await qrcode.toDataURL(otpauthUrl);

    // Encrypt secret at rest before saving as pending
    const encryptedSecret = encryptSecret(secret);
    userRepo.setPendingTotp(user.id, encryptedSecret);

    res.status(200).json({
      success: true,
      secret,
      qrCode,
    });
  }
);

// POST /api/auth/2fa/enable
router.post(
  "/2fa/enable",
  requireAuth,
  doubleCsrfProtection,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = enable2faSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Invalid verification code.",
      });
      return;
    }

    const user = userRepo.findById(req.session.userId!);
    if (!user || !user.pending_totp_secret_encrypted) {
      res.status(400).json({
        success: false,
        message: "2FA setup has not been initiated. Please run setup first.",
      });
      return;
    }

    const secret = decryptSecret(user.pending_totp_secret_encrypted);
    const isValid = verifySync({ token: parsed.data.code.trim(), secret }).valid;

    if (!isValid) {
      res.status(400).json({
        success: false,
        message: "Invalid authenticator code. Check your authenticator app and try again.",
      });
      return;
    }

    // Generate 8 single-use recovery codes
    const { rawCodes, hashedCodes } = generateRecoveryCodes(8);

    userRepo.enableTotp(user.id, user.pending_totp_secret_encrypted, JSON.stringify(hashedCodes));

    const ip = getClientIp(req);
    const changedAt = new Date().toISOString();

    activityRepo.record({
      id: uuidv4(),
      userId: user.id,
      timestamp: changedAt,
      ip,
      userAgent: req.headers["user-agent"] ?? "unknown",
      success: true,
      failureReason: "2FA enabled",
    });

    // Notify the user (async, never blocks response)
    void sendMail({
      to: user.email,
      subject: "SecureAuth: Two-factor authentication enabled",
      template: "twoFactorEnabled",
      data: {
        changedAt: new Date(changedAt).toLocaleString("en-US", { timeZone: "UTC" }) + " UTC",
        ip,
      },
    });

    res.status(200).json({
      success: true,
      recoveryCodes: rawCodes,
    });
  }
);

// POST /api/auth/2fa/disable
router.post(
  "/2fa/disable",
  requireAuth,
  doubleCsrfProtection,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = disable2faSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Password and verification code are required.",
      });
      return;
    }

    const user = userRepo.findById(req.session.userId!);
    if (!user || user.totp_enabled !== 1 || !user.totp_secret_encrypted) {
      res.status(400).json({
        success: false,
        message: "Two-factor authentication is not currently enabled.",
      });
      return;
    }

    // 1. Verify current password
    const pwdMatch = await verifyPassword(parsed.data.password, user.password_hash);
    if (!pwdMatch) {
      res.status(401).json({
        success: false,
        message: "Invalid password.",
      });
      return;
    }

    // 2. Verify code (TOTP or recovery code)
    const secret = decryptSecret(user.totp_secret_encrypted);
    const isTotpValid = verifySync({ token: parsed.data.code.trim(), secret }).valid;
    let isRecoveryValid = false;

    if (!isTotpValid && user.totp_recovery_codes_hash) {
      try {
        const hashes: string[] = JSON.parse(user.totp_recovery_codes_hash);
        const recCheck = verifyRecoveryCode(parsed.data.code, hashes);
        if (recCheck.valid) isRecoveryValid = true;
      } catch {
        // ignore error
      }
    }

    if (!isTotpValid && !isRecoveryValid) {
      res.status(400).json({
        success: false,
        message: "Invalid authenticator code.",
      });
      return;
    }

    userRepo.disableTotp(user.id);

    const ip = getClientIp(req);
    const changedAt = new Date().toISOString();

    activityRepo.record({
      id: uuidv4(),
      userId: user.id,
      timestamp: changedAt,
      ip,
      userAgent: req.headers["user-agent"] ?? "unknown",
      success: true,
      failureReason: "2FA disabled",
    });

    // Notify the user (async, never blocks response)
    void sendMail({
      to: user.email,
      subject: "SecureAuth: Two-factor authentication disabled",
      template: "twoFactorDisabled",
      data: {
        changedAt: new Date(changedAt).toLocaleString("en-US", { timeZone: "UTC" }) + " UTC",
        ip,
      },
    });

    res.status(200).json({
      success: true,
      message: "Two-factor authentication disabled successfully.",
    });
  }
);

export default router;
