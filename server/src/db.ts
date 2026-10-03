/**
 * SQLite database layer using better-sqlite3.
 *
 * Tables
 * ──────
 *   users            — registered accounts
 *   login_attempts   — every auth attempt (success + failure) for audit + lockout
 *
 * All DDL is idempotent (CREATE TABLE IF NOT EXISTS) so the same file works for
 * both a fresh start and restarts against an existing database.
 */

import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Resolve DB path: respect DATA_DIR env var so tests can use :memory: */
const DB_PATH = process.env.DB_PATH ?? path.join(__dirname, "../../secureauth.db");

export const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma("journal_mode = WAL");
// Enforce foreign-key constraints
db.pragma("foreign_keys = ON");

// ── Schema ────────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id                            TEXT    PRIMARY KEY,
    name                          TEXT    NOT NULL,
    email                         TEXT    NOT NULL UNIQUE,   -- stored lowercase-trimmed
    password_hash                 TEXT    NOT NULL,
    reset_token_hash              TEXT,                       -- SHA-256 of the raw token
    reset_token_expiry            INTEGER,                    -- Unix ms
    locked_until                  INTEGER,                    -- Unix ms; NULL = not locked
    failed_attempts               INTEGER NOT NULL DEFAULT 0,
    session_version               INTEGER NOT NULL DEFAULT 1,
    totp_secret_encrypted         TEXT,
    totp_enabled                  INTEGER NOT NULL DEFAULT 0,
    totp_recovery_codes_hash      TEXT,
    pending_totp_secret_encrypted TEXT,
    created_at                    TEXT    NOT NULL,
    last_login_at                 TEXT,
    email_verified                INTEGER NOT NULL DEFAULT 0, -- 0 = unverified, 1 = verified
    known_ips                     TEXT    NOT NULL DEFAULT '[]' -- JSON array of seen IP+UA fingerprints
  ) STRICT;

  CREATE TABLE IF NOT EXISTS login_attempts (
    id             TEXT    PRIMARY KEY,
    user_id        TEXT    NOT NULL,
    timestamp      TEXT    NOT NULL,
    ip             TEXT    NOT NULL,
    user_agent     TEXT    NOT NULL,
    success        INTEGER NOT NULL,                   -- 0 or 1 (SQLite has no BOOLEAN)
    failure_reason TEXT
  ) STRICT;

  CREATE TABLE IF NOT EXISTS password_reset_otps (
    id          TEXT    PRIMARY KEY,
    user_id     TEXT    NOT NULL,
    otp_hash    TEXT    NOT NULL,
    expires_at  INTEGER NOT NULL,
    attempts    INTEGER NOT NULL DEFAULT 0,
    consumed_at TEXT,
    created_at  TEXT    NOT NULL
  ) STRICT;

  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id          TEXT    PRIMARY KEY,
    user_id     TEXT    NOT NULL,
    token_hash  TEXT    NOT NULL UNIQUE,
    expires_at  INTEGER NOT NULL,
    consumed_at TEXT,
    created_at  TEXT    NOT NULL
  ) STRICT;

  CREATE TABLE IF NOT EXISTS email_verifications (
    id          TEXT    PRIMARY KEY,
    user_id     TEXT    NOT NULL,
    code_hash   TEXT    NOT NULL,  -- HMAC-SHA256 of the 6-digit code
    expires_at  INTEGER NOT NULL,  -- Unix ms
    attempts    INTEGER NOT NULL DEFAULT 0,
    consumed_at TEXT,
    created_at  TEXT    NOT NULL
  ) STRICT;
`);

// Safe column migrations for existing databases
const userColumns = db.pragma("table_info(users)") as Array<{ name: string }>;
const colNames = new Set(userColumns.map((c) => c.name));

if (!colNames.has("session_version")) {
  db.exec("ALTER TABLE users ADD COLUMN session_version INTEGER NOT NULL DEFAULT 1;");
}
if (!colNames.has("totp_secret_encrypted")) {
  db.exec("ALTER TABLE users ADD COLUMN totp_secret_encrypted TEXT;");
}
if (!colNames.has("totp_enabled")) {
  db.exec("ALTER TABLE users ADD COLUMN totp_enabled INTEGER NOT NULL DEFAULT 0;");
}
if (!colNames.has("totp_recovery_codes_hash")) {
  db.exec("ALTER TABLE users ADD COLUMN totp_recovery_codes_hash TEXT;");
}
if (!colNames.has("pending_totp_secret_encrypted")) {
  db.exec("ALTER TABLE users ADD COLUMN pending_totp_secret_encrypted TEXT;");
}
if (!colNames.has("email_verified")) {
  // Seed users are treated as pre-verified to avoid breaking the demo.
  db.exec("ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 1;");
  // New users (created after this migration) will get DEFAULT 0 via the CREATE TABLE definition.
}
if (!colNames.has("known_ips")) {
  db.exec("ALTER TABLE users ADD COLUMN known_ips TEXT NOT NULL DEFAULT '[]';");
}

