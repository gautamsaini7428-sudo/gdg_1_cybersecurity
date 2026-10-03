/**
 * Repository layer — all DB access goes through here.
 * Keeps SQL out of route handlers and makes unit-testing easy.
 */

import { db } from "./db.js";
import { AUTH_CONFIG } from "../../shared/const.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  reset_token_hash: string | null;
  reset_token_expiry: number | null;
  locked_until: number | null;
  failed_attempts: number;
  session_version: number;
  totp_secret_encrypted: string | null;
  totp_enabled: number;
  totp_recovery_codes_hash: string | null;
  pending_totp_secret_encrypted: string | null;
  created_at: string;
  last_login_at: string | null;
  email_verified: number; // 0 = unverified, 1 = verified
  known_ips: string;      // JSON array of "ip|ua" fingerprint strings
}

export interface StoredEmailVerification {
  id: string;
  user_id: string;
  code_hash: string;
  expires_at: number;
  attempts: number;
  consumed_at: string | null;
  created_at: string;
}

export interface StoredResetOtp {
  id: string;
  user_id: string;
  otp_hash: string;
  expires_at: number;
  attempts: number;
  consumed_at: string | null;
  created_at: string;
}

export interface StoredResetToken {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: number;
  consumed_at: string | null;
  created_at: string;
}

export interface LoginAttempt {
  id: string;
  user_id: string;
  timestamp: string;
  ip: string;
  user_agent: string;
  success: 0 | 1;
  failure_reason: string | null;
}

/** Shape returned to the client — never includes password_hash or token material */
export interface PublicUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  lastLoginAt: string | null;
  totpEnabled: boolean;
  emailVerified: boolean;
}

export function toPublicUser(u: StoredUser): PublicUser {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    createdAt: u.created_at,
    lastLoginAt: u.last_login_at ?? null,
    totpEnabled: u.totp_enabled === 1,
    emailVerified: u.email_verified === 1,
  };
}

// ── Prepared statements ───────────────────────────────────────────────────────

const stmts = {
  findByEmail: db.prepare<[string], StoredUser>(
    "SELECT * FROM users WHERE email = ?"
  ),
  findById: db.prepare<[string], StoredUser>(
    "SELECT * FROM users WHERE id = ?"
  ),
  insert: db.prepare<
    [string, string, string, string, string, number],
    StoredUser
  >(
    `INSERT INTO users (id, name, email, password_hash, created_at, email_verified)
     VALUES (?, ?, ?, ?, ?, ?)
     RETURNING *`
  ),
  updateLastLogin: db.prepare<[string, string]>(
    "UPDATE users SET last_login_at = ?, failed_attempts = 0, locked_until = NULL WHERE id = ?"
  ),
  incrementFailedAttempts: db.prepare<[number | null, string]>(
    "UPDATE users SET failed_attempts = failed_attempts + 1, locked_until = ? WHERE id = ?"
  ),
  resetFailedAttempts: db.prepare<[string]>(
    "UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?"
  ),
  setResetToken: db.prepare<[string, number, string]>(
    "UPDATE users SET reset_token_hash = ?, reset_token_expiry = ? WHERE id = ?"
  ),
  clearResetToken: db.prepare<[string, string]>(
    "UPDATE users SET reset_token_hash = NULL, reset_token_expiry = NULL, password_hash = ? WHERE id = ?"
  ),
  updatePasswordAndRevoke: db.prepare<[string, string]>(
    `UPDATE users 
     SET password_hash = ?, 
         session_version = session_version + 1,
         reset_token_hash = NULL,
         reset_token_expiry = NULL
     WHERE id = ?`
  ),
  incrementSessionVersion: db.prepare<[string]>(
    "UPDATE users SET session_version = session_version + 1 WHERE id = ?"
  ),
  setPendingTotp: db.prepare<[string | null, string]>(
    "UPDATE users SET pending_totp_secret_encrypted = ? WHERE id = ?"
  ),
  enableTotp: db.prepare<[string, string, string]>(
    `UPDATE users 
     SET totp_enabled = 1,
         totp_secret_encrypted = ?,
         totp_recovery_codes_hash = ?,
         pending_totp_secret_encrypted = NULL
     WHERE id = ?`
  ),
  disableTotp: db.prepare<[string]>(
    `UPDATE users 
     SET totp_enabled = 0,
         totp_secret_encrypted = NULL,
         totp_recovery_codes_hash = NULL,
         pending_totp_secret_encrypted = NULL
     WHERE id = ?`
  ),
  updateRecoveryCodes: db.prepare<[string, string]>(
    "UPDATE users SET totp_recovery_codes_hash = ? WHERE id = ?"
  ),
  recordAttempt: db.prepare<
    [string, string, string, string, string, 0 | 1, string | null]
  >(
    `INSERT INTO login_attempts (id, user_id, timestamp, ip, user_agent, success, failure_reason)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ),
  activityForUser: db.prepare<[string, number], LoginAttempt>(
    `SELECT * FROM login_attempts WHERE user_id = ?
     ORDER BY timestamp DESC LIMIT ?`
  ),
  failedLast24h: db.prepare<[string, string], { count: number }>(
    `SELECT COUNT(*) as count FROM login_attempts
     WHERE user_id = ? AND success = 0 AND timestamp > ?`
  ),

  // Reset OTPs
  insertResetOtp: db.prepare<[string, string, string, number, string]>(
    `INSERT INTO password_reset_otps (id, user_id, otp_hash, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ),
  getLatestOtpForUser: db.prepare<[string], StoredResetOtp>(
    `SELECT * FROM password_reset_otps 
     WHERE user_id = ? AND consumed_at IS NULL
     ORDER BY created_at DESC LIMIT 1`
  ),
  incrementOtpAttempts: db.prepare<[string]>(
    "UPDATE password_reset_otps SET attempts = attempts + 1 WHERE id = ?"
  ),
  consumeOtp: db.prepare<[string, string]>(
    "UPDATE password_reset_otps SET consumed_at = ? WHERE id = ?"
  ),
  invalidateAllOtpsForUser: db.prepare<[string, string]>(
    "UPDATE password_reset_otps SET consumed_at = ? WHERE user_id = ? AND consumed_at IS NULL"
  ),

  // Reset Tokens
  insertResetToken: db.prepare<[string, string, string, number, string]>(
    `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ),
  findResetTokenByHash: db.prepare<[string], StoredResetToken>(
    "SELECT * FROM password_reset_tokens WHERE token_hash = ?"
  ),
  consumeResetToken: db.prepare<[string, string]>(
    "UPDATE password_reset_tokens SET consumed_at = ? WHERE id = ?"
  ),

  // Email Verifications
  insertEmailVerification: db.prepare<[string, string, string, number, string]>(
    `INSERT INTO email_verifications (id, user_id, code_hash, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ),
  getLatestEmailVerification: db.prepare<[string], StoredEmailVerification>(
    `SELECT * FROM email_verifications
     WHERE user_id = ? AND consumed_at IS NULL
     ORDER BY created_at DESC LIMIT 1`
  ),
  incrementEmailVerAttempts: db.prepare<[string]>(
    "UPDATE email_verifications SET attempts = attempts + 1 WHERE id = ?"
  ),
  consumeEmailVerification: db.prepare<[string, string]>(
    "UPDATE email_verifications SET consumed_at = ? WHERE id = ?"
  ),
  invalidateAllEmailVerForUser: db.prepare<[string, string]>(
    "UPDATE email_verifications SET consumed_at = ? WHERE user_id = ? AND consumed_at IS NULL"
  ),
  markUserEmailVerified: db.prepare<[string]>(
    "UPDATE users SET email_verified = 1 WHERE id = ?"
  ),

  // Known IPs (for new-login-alert fingerprinting)
  updateKnownIps: db.prepare<[string, string]>(
    "UPDATE users SET known_ips = ? WHERE id = ?"
  ),
};

// ── Public API ────────────────────────────────────────────────────────────────

export const userRepo = {
  findByEmail(email: string): StoredUser | undefined {
    return stmts.findByEmail.get(email.toLowerCase().trim());
  },

  findById(id: string): StoredUser | undefined {
    return stmts.findById.get(id);
  },

  create(user: {
    id: string;
    name: string;
    email: string;
    passwordHash: string;
    createdAt: string;
    emailVerified?: boolean;
  }): StoredUser {
    const verifiedInt = user.emailVerified ? 1 : 0;
    const created = stmts.insert.get(
      user.id,
      user.name.trim(),
      user.email.toLowerCase().trim(),
      user.passwordHash,
      user.createdAt,
      verifiedInt
    );
    return created || (stmts.findById.get(user.id) as StoredUser);
  },

  markLogin(userId: string, now: string): void {
    stmts.updateLastLogin.run(now, userId);
  },

  /**
   * Increment the failed-attempt counter.
   * If the new count reaches the lockout threshold, set `locked_until`.
   */
  recordFailedAttempt(user: StoredUser): void {
    const newCount = user.failed_attempts + 1;
    const lockedUntil =
      newCount >= AUTH_CONFIG.MAX_FAILED_LOGIN_ATTEMPTS
        ? Date.now() + AUTH_CONFIG.LOCKOUT_DURATION_MINUTES * 60 * 1000
        : null;
    stmts.incrementFailedAttempts.run(lockedUntil, user.id);
  },

  resetFailedAttempts(userId: string): void {
    stmts.resetFailedAttempts.run(userId);
  },

  setResetToken(userId: string, tokenHash: string, expiryMs: number): void {
    stmts.setResetToken.run(tokenHash, expiryMs, userId);
  },

  clearResetToken(userId: string, newPasswordHash: string): void {
    stmts.clearResetToken.run(newPasswordHash, userId);
  },

  updatePasswordAndRevoke(userId: string, newPasswordHash: string): void {
    stmts.updatePasswordAndRevoke.run(newPasswordHash, userId);
  },

  incrementSessionVersion(userId: string): void {
    stmts.incrementSessionVersion.run(userId);
  },

  setPendingTotp(userId: string, encryptedSecret: string | null): void {
    stmts.setPendingTotp.run(encryptedSecret, userId);
  },

  enableTotp(userId: string, encryptedSecret: string, recoveryCodesHashJson: string): void {
    stmts.enableTotp.run(encryptedSecret, recoveryCodesHashJson, userId);
  },

  disableTotp(userId: string): void {
    stmts.disableTotp.run(userId);
  },

  updateRecoveryCodes(userId: string, recoveryCodesHashJson: string): void {
    stmts.updateRecoveryCodes.run(recoveryCodesHashJson, userId);
  },

  emailExists(email: string): boolean {
    return !!stmts.findByEmail.get(email.toLowerCase().trim());
  },

  markEmailVerified(userId: string): void {
    stmts.markUserEmailVerified.run(userId);
  },

  /**
   * Returns true if the ip+ua fingerprint has been seen before for this user.
   * Adds it to the known set if it is new.
   */
  checkAndAddFingerprint(user: StoredUser, ip: string, ua: string): { isNew: boolean } {
    const fingerprint = `${ip}|${ua.slice(0, 200)}`;
    let known: string[];
    try {
      known = JSON.parse(user.known_ips || "[]");
    } catch {
      known = [];
    }
    if (known.includes(fingerprint)) {
      return { isNew: false };
    }
    // Keep at most 50 entries to prevent unbounded growth
    const updated = [fingerprint, ...known].slice(0, 50);
    stmts.updateKnownIps.run(JSON.stringify(updated), user.id);
    return { isNew: true };
  },
};

export const resetOtpRepo = {
  create(id: string, userId: string, otpHash: string, expiresAt: number): void {
    const now = new Date().toISOString();
    // Invalidate prior OTPs
    stmts.invalidateAllOtpsForUser.run(now, userId);
    stmts.insertResetOtp.run(id, userId, otpHash, expiresAt, now);
  },

  getLatestActive(userId: string): StoredResetOtp | undefined {
    return stmts.getLatestOtpForUser.get(userId);
  },

  incrementAttempts(otpId: string): void {
    stmts.incrementOtpAttempts.run(otpId);
  },

  consume(otpId: string): void {
    stmts.consumeOtp.run(new Date().toISOString(), otpId);
  },

  invalidate(otpId: string): void {
    stmts.consumeOtp.run(new Date().toISOString(), otpId);
  },
};

export const resetTokenRepo = {
  create(id: string, userId: string, tokenHash: string, expiresAt: number): void {
    stmts.insertResetToken.run(id, userId, tokenHash, expiresAt, new Date().toISOString());
  },

  findByHash(tokenHash: string): StoredResetToken | undefined {
    return stmts.findResetTokenByHash.get(tokenHash);
  },

  consume(tokenId: string): void {
    stmts.consumeResetToken.run(new Date().toISOString(), tokenId);
  },
};

export const activityRepo = {
  record(attempt: {
    id: string;
    userId: string;
    timestamp: string;
    ip: string;
    userAgent: string;
    success: boolean;
    failureReason?: string;
  }): void {
    stmts.recordAttempt.run(
      attempt.id,
      attempt.userId,
      attempt.timestamp,
      attempt.ip,
      attempt.userAgent,
      attempt.success ? 1 : 0,
      attempt.failureReason ?? null
    );
  },

  forUser(userId: string, limit = 20): LoginAttempt[] {
    return stmts.activityForUser.all(userId, limit);
  },

  failedLast24h(userId: string): number {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    return stmts.failedLast24h.get(userId, since)?.count ?? 0;
  },
};

/** Repository for the email address verification flow. */
export const emailVerificationRepo = {
  /**
   * Invalidates all pending verifications for the user and creates a new one.
   */
  create(id: string, userId: string, codeHash: string, expiresAt: number): void {
    const now = new Date().toISOString();
    stmts.invalidateAllEmailVerForUser.run(now, userId);
    stmts.insertEmailVerification.run(id, userId, codeHash, expiresAt, now);
  },

  getLatestActive(userId: string): StoredEmailVerification | undefined {
    return stmts.getLatestEmailVerification.get(userId);
  },

  incrementAttempts(verificationId: string): void {
    stmts.incrementEmailVerAttempts.run(verificationId);
  },

  consume(verificationId: string): void {
    stmts.consumeEmailVerification.run(new Date().toISOString(), verificationId);
  },

  invalidate(verificationId: string): void {
    stmts.consumeEmailVerification.run(new Date().toISOString(), verificationId);
  },
};
