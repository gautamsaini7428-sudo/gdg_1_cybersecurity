/**
 * Shared Authentication & Security System Constants
 * Synchronized with backend security policies and OWASP ASVS Level 1 guidelines.
 */

export const AUTH_CONFIG = {
  HASH_ALGORITHM: "bcrypt",
  BCRYPT_SALT_ROUNDS: 12,
  MAX_FAILED_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION_MINUTES: 15,
  SESSION_LIFETIME_HOURS: 24,
  COOKIE_NAME: "secureauth_session",
  RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000,
  PASSWORD_MIN_LENGTH: 8,
} as const;

export const COOKIE_NAME = AUTH_CONFIG.COOKIE_NAME;
export const UNAUTHED_ERR_MSG = "Authentication required. Please sign in.";
