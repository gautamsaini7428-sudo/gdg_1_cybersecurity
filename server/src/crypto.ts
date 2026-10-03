/**
 * Crypto helpers — Argon2id with bcrypt fallback.
 *
 * @node-rs/argon2 uses a Rust native binding. If it fails to load (e.g. ARM
 * build on a host without the pre-built binary), we transparently fall back to
 * pure-JS bcryptjs at cost-12, which is the OWASP ASVS Level 1 minimum.
 *
 * Never call bcrypt.compare with a null/undefined hash — it can return true
 * in some versions. We always guard on user existence before comparing.
 */

import * as crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { AUTH_CONFIG } from "../../shared/const.js";

// ── Argon2id ──────────────────────────────────────────────────────────────────

let argon2: typeof import("@node-rs/argon2") | null = null;

try {
  argon2 = await import("@node-rs/argon2");
} catch {
  console.warn(
    "[crypto] @node-rs/argon2 not available — falling back to bcrypt cost-12"
  );
}

export async function hashPassword(password: string): Promise<string> {
  if (argon2) {
    return argon2.hash(password, {
      memoryCost: AUTH_CONFIG.ARGON2_MEMORY_COST,
      timeCost: AUTH_CONFIG.ARGON2_ITERATIONS,
      parallelism: AUTH_CONFIG.ARGON2_PARALLELISM,
    });
  }
  return bcrypt.hash(password, AUTH_CONFIG.BCRYPT_SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  if (argon2) {
    try {
      return await argon2.verify(hash, password);
    } catch {
      // Hash might be a legacy bcrypt hash — fall through to bcrypt verify
    }
  }
  return bcrypt.compare(password, hash);
}

/**
 * Dummy hash + compare to prevent timing-based user enumeration.
 * Call this whenever a user does NOT exist in the DB.
 */
export async function dummyVerify(): Promise<void> {
  if (argon2) {
    const fakeHash = await argon2.hash("dummy_secret_x9k!", {
      memoryCost: AUTH_CONFIG.ARGON2_MEMORY_COST,
      timeCost: AUTH_CONFIG.ARGON2_ITERATIONS,
      parallelism: AUTH_CONFIG.ARGON2_PARALLELISM,
    });
    await argon2.verify(fakeHash, "not_the_password");
  } else {
    const fakeHash = await bcrypt.hash("dummy_x9k", AUTH_CONFIG.BCRYPT_SALT_ROUNDS);
    await bcrypt.compare("not_the_password", fakeHash);
  }
}

// ── Reset tokens & OTPs ───────────────────────────────────────────────────────

const PEPPER = process.env.OTP_PEPPER || process.env.SESSION_SECRET || "secureauth-pepper-secret-fallback-key-32";

/** Generate a 6-digit verification code using cryptographically secure random integers */
export function generateResetOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

/** SHA-256 HMAC hash of 6-digit code with server pepper */
export function hashOtp(code: string): string {
  return crypto.createHmac("sha256", PEPPER).update(code.trim()).digest("hex");
}

/** Generate a cryptographically-random URL-safe reset token (hex string) */
export function generateResetToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/** SHA-256 HMAC hash of raw reset token with server pepper */
export function hashResetToken(rawToken: string): string {
  return crypto.createHmac("sha256", PEPPER).update(rawToken.trim()).digest("hex");
}

// ── 2FA Secret Encryption (AES-256-GCM at rest) ────────────────────────────────

const ENCRYPTION_KEY = crypto.createHash("sha256").update(PEPPER).digest(); // 32 bytes

export function encryptSecret(plainText: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptSecret(encryptedPayload: string): string {
  const parts = encryptedPayload.split(":");
  if (parts.length !== 3) throw new Error("Invalid encrypted payload format");
  const [ivHex, tagHex, contentHex] = parts;
  const decipher = crypto.createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(contentHex, "hex")), decipher.final()]);
  return decrypted.toString("utf8");
}

// ── 2FA Recovery Codes ────────────────────────────────────────────────────────

export function generateRecoveryCodes(count = 8): { rawCodes: string[]; hashedCodes: string[] } {
  const rawCodes: string[] = [];
  const hashedCodes: string[] = [];
  for (let i = 0; i < count; i++) {
    const p1 = crypto.randomBytes(2).toString("hex").toUpperCase();
    const p2 = crypto.randomBytes(2).toString("hex").toUpperCase();
    const code = `${p1}-${p2}`;
    rawCodes.push(code);
    hashedCodes.push(crypto.createHash("sha256").update(code).digest("hex"));
  }
  return { rawCodes, hashedCodes };
}

export function verifyRecoveryCode(
  inputCode: string,
  hashedCodes: string[]
): { valid: boolean; remainingHashedCodes: string[] } {
  const normalized = inputCode.trim().toUpperCase();
  const inputHash = crypto.createHash("sha256").update(normalized).digest("hex");
  const matchIndex = hashedCodes.indexOf(inputHash);
  if (matchIndex === -1) {
    return { valid: false, remainingHashedCodes: hashedCodes };
  }
  const remaining = [...hashedCodes];
  remaining.splice(matchIndex, 1);
  return { valid: true, remainingHashedCodes: remaining };
}
