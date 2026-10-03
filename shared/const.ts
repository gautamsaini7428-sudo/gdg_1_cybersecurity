/**
 * Shared Authentication & Security System Constants
 * Synchronized between Node.js Express backend and React frontend.
 * The landing page stat counters read these values directly.
 */

export const AUTH_CONFIG = {
  /** Display name for the hash algorithm used (shown on landing page) */
  HASH_ALGORITHM: "argon2id" as const,

  /** Bcrypt cost factor — fallback when argon2 native binding unavailable */
  BCRYPT_SALT_ROUNDS: 12,

  /** Argon2id memory cost in KiB (64 MiB — OWASP minimum recommendation) */
  ARGON2_MEMORY_COST: 65536,

  /** Argon2id parallelism factor */
  ARGON2_PARALLELISM: 1,

  /** Argon2id iteration count */
  ARGON2_ITERATIONS: 3,

  /** Max consecutive failed logins before per-account lockout */
  MAX_FAILED_LOGIN_ATTEMPTS: 5,

  /** How long the account stays locked after threshold (minutes) */
  LOCKOUT_DURATION_MINUTES: 15,

  /** Session cookie lifetime (hours) — rolled on every request */
  SESSION_LIFETIME_HOURS: 24,

  /** Name of the session cookie set by the server */
  COOKIE_NAME: "sa.sid",

  /** IP-level rate-limit window in milliseconds (15 min) */
  RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000,

  /** Max login attempts per IP per rate-limit window */
  RATE_LIMIT_MAX_REQUESTS: 10,

  /** Minimum password length enforced by Zod and the server */
  PASSWORD_MIN_LENGTH: 8,

  /** Password-reset OTP lifetime (minutes) */
  RESET_OTP_EXPIRY_MINUTES: 10,

  /** Max attempts on a single OTP before invalidation */
  RESET_OTP_MAX_ATTEMPTS: 5,

  /** Password-reset token lifetime (minutes) */
  RESET_TOKEN_EXPIRY_MINUTES: 10,

  /** Header name that must carry the CSRF token for state-changing requests */
  CSRF_HEADER: "x-csrf-token",
} as const;

export const COOKIE_NAME = AUTH_CONFIG.COOKIE_NAME;
export const UNAUTHED_ERR_MSG = "Authentication required. Please sign in.";
