# SecureAuth — Enterprise Authentication & Security Platform

A production-grade, full-stack authentication system built with modern security best practices, OWASP ASVS compliance, and a refined modern interface.

---

## 🌟 Security Architecture Highlights

- **Password Hashing**: OWASP-recommended **Argon2id** (`@node-rs/argon2`, 64 MiB memory, 3 iterations) with transparent fallback to `bcryptjs` (cost factor 12).
- **Constant-Time Verification**: Prevents timing attacks and account enumeration via `dummyVerify()`.
- **Session Management**: Server-side sessions with opaque session IDs stored in `HttpOnly`, `SameSite=Lax`, and `Secure` (production) cookies. Never stored in `localStorage`.
- **CSRF Protection**: Double-Submit Cookie pattern via `csrf-csrf` (`sa.csrf` cookie + `x-csrf-token` header).
- **Two-Tier Brute-Force Defense**:
  - IP-based rate limiting via `express-rate-limit`.
  - Per-account lockout triggered on the 5th consecutive failed attempt (15-minute freeze), synchronized with shared configuration.
- **Audit Logging**: Every authentication attempt (success, failure reason, IP, user-agent, timestamp) is recorded in SQLite and accessible via the user's Activity Dashboard.
- **Email Verification Gate**: Accounts remain "unverified" until the user submits the 6-digit code sent at registration. Login is blocked with a clear message until verified. A `POST /resend-verify` endpoint (60 s cooldown, IP-rate-limited) lets users request a fresh code.
- **Security Alert Emails**: Async, fire-and-forget emails for password changes, new logins from unknown IP/UA, 2FA toggled, and account lockouts — never block HTTP responses, never leak sensitive data.
- **Per-recipient Email Rate Limit**: At most 5 emails/hour per address to prevent abuse.
- **Type Safety**: Unified Zod validation schemas shared between frontend and backend (`/shared`).

For detailed architectural rationale and threat modeling, refer to [DECISIONS.md](./DECISIONS.md).

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js** v18.0.0 or higher
- **npm** v9.0.0 or higher

### 2. Installation
Install dependencies for both root, client, and server:
```bash
# Install root orchestration dependencies
npm install

# Install server dependencies
cd server && npm install && cd ..

# Install client dependencies
cd client && npm install && cd ..
```

### 3. Environment Configuration
Copy the sample environment file to the server:
```bash
cp .env.example server/.env
```

#### Environment Variables (`.env.example`):
| Variable | Description | Default |
|---|---|---|
| `PORT` | Backend Express server port | `5000` |
| `NODE_ENV` | Application mode (`development` \| `production` \| `test`) | `development` |
| `CLIENT_ORIGIN` | Allowed frontend origin for CORS with credentials | `http://localhost:5173` |
| `SESSION_SECRET` | 32+ character key for cookie and session encryption | *random development string* |
| `DB_PATH` | Path to SQLite database file *(optional)* | `../secureauth.db` |
| `SMTP_HOST` | Hostname of your SMTP relay provider | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP port (`587` for STARTTLS, `465` for SSL/TLS) | `587` |
| `SMTP_SECURE` | Whether to use SSL/TLS (`true` for port 465, `false` for 587) | `false` |
| `SMTP_USER` | Authenticated SMTP account / email address | *none (placeholder)* |
| `SMTP_PASS` | Authenticated SMTP password or App Password | *none (placeholder)* |
| `MAIL_FROM` | RFC 5322 formatted sender string | `"SecureAuth <noreply@...>` |

---

### 📧 SMTP & Gmail App Password Setup

SecureAuth dispatches production-grade HTML verification emails for password resets and security notices using Nodemailer. Follow these steps to configure email delivery via Gmail:

#### Step 1: Generate a Google App Password
1. Navigate to your [Google Account Security Settings](https://myaccount.google.com/security).
2. Ensure **2-Step Verification** is turned ON for your account (required by Google for app passwords).
3. Search for **"App passwords"** in the top search bar or scroll under 2-Step Verification to find **App passwords**.
4. In the app name prompt, enter `SecureAuth` and click **Create**.
5. Google will display a 16-character passcode (formatted as `xxxx xxxx xxxx xxxx`). **Copy this passcode** without spaces (`xxxxxxxxxxxxxxxx`). *Note: Never use your main Google password.*

#### Step 2: Configure Environment Variables
Open `server/.env` (or `.env` in the root workspace) and update the SMTP fields:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-actual-email@gmail.com
SMTP_PASS=xxxxxxxxxxxxxxxx
MAIL_FROM="SecureAuth <your-actual-email@gmail.com>"
```

#### Step 3: Server Startup Connection Verification
When the Express server boots up, it automatically tests the SMTP connection via `transporter.verify()`:
- **Success**: Logs `SMTP ready`
- **Failure**: Logs `SMTP failed: <reason>` with detailed diagnosis (e.g. invalid credentials or unreachable host).

#### Step 4: Verify Delivery with the Email Test Utility
You can instantly test your SMTP configuration without triggering a web request:
```bash
npm run test:email your-email@gmail.com
```
This sends a styled HTML verification email with the SecureAuth palette (`#0B2925` header, `#A7F3D0` emerald accent, `#F8F5F3` card background) and monospace OTP code.

#### Step 5: Development Console Fallback
- When `NODE_ENV=development`, the 6-digit OTP code is **ALSO printed to the server terminal** as a fallback. This guarantees that local development and demos never get blocked even if SMTP is misconfigured or rate-limited.
- In `production`, codes and SMTP credentials are **strictly suppressed** from all logs.

---

### 📨 Transactional Security Emails

All emails are dispatched through the single **`sendMail({ to, subject, template, data })`** function in [`server/src/services/emailService.ts`](./server/src/services/emailService.ts). Templates live in [`server/src/emails/`](./server/src/emails/). Every email:

- Uses the **shared HTML layout** (header `#0B2925`, accent `#A7F3D0`, background `#F8F5F3`, footer "This is an automated security email")
- Includes a **plain-text fallback** for email clients that don't render HTML
- Is sent **asynchronously** (`void sendMail(…)`) — SMTP errors are caught and logged server-side, never surfacing to HTTP clients

| Template | Trigger | Key Content |
|---|---|---|
| `verifyEmail` | User registers | 6-digit code; account stays unverified until confirmed |
| `resetOtp` | `POST /forgot-password` | 6-digit one-time password for password reset |
| `passwordChanged` | `POST /reset-password` success | Time of change, IP, "If this wasn't you…" |
| `newLoginAlert` | Login from new IP or user-agent | Timestamp, IP, UA, "If this wasn't you…" |
| `twoFactorEnabled` | `POST /2fa/enable` success | Time, IP, reminder to keep recovery codes |
| `twoFactorDisabled` | `POST /2fa/disable` success | Time, IP, "If this wasn't you…" |
| `accountLocked` | 5th consecutive failed login | Locked-until, attempt count, IP, reset prompt |

**Per-recipient rate limit**: ≤ 5 emails / hour / address (env vars: `EMAIL_RATE_LIMIT`, `EMAIL_RATE_WINDOW_MS`). Excess calls are silently dropped and logged.

**Resend verification**: `POST /api/auth/resend-verify` — 60-second cooldown per account, 3 requests per 5 minutes per IP.

---


### 4. Seed Demonstration Data
Populate the database with demo accounts and audit trails:
```bash
npm run seed
```
Demo accounts created:
- **Admin**: `alex@secureauth.io` / `StrongPassword123!`
- **Auditor**: `auditor@enterprise.corp` / `EnterpriseAudit999!`

### 5. Run the Application
Launch both Vite frontend (`http://localhost:5173`) and Express backend (`http://localhost:5000`) concurrently:
```bash
npm run dev
```

Alternatively, run each service independently:
```bash
# Frontend only (Vite dev server)
npm run dev:client

# Backend only (Express dev server with tsx watch)
npm run dev:server
```

---

## 🧪 Testing & Quality Assurance

### Run Integration & Unit Tests
Executes the comprehensive Vitest + Supertest suite (covering CSRF rejection, registration, login, session persistence, lockout triggers, and activity logging):
```bash
npm test
```
All 13 integration tests pass:
```
 ✓ src/tests/auth.test.ts (13 tests) 13 passed
```

### Type Checking & Build Validation
```bash
# Type check client
npm run check

# Production build client
npm run build
```

---

## 📂 Project Structure

```
├── client/                     # React + Vite frontend
│   ├── src/
│   │   ├── components/         # UI components & interactive 3D SVG arena
│   │   ├── contexts/           # AuthContext (user state, session status, logout)
│   │   ├── lib/api.ts          # CSRF-aware fetch client with auto-retry
│   │   ├── pages/              # Home, Access (Login/Register/Reset), Dashboard
│   │   └── index.css           # Curated design tokens (Forest Green, Mint, Charcoal)
├── server/                     # Node.js + Express + TypeScript backend
│   ├── src/
│   │   ├── db.ts               # SQLite setup with WAL mode & strict tables
│   │   ├── repository.ts       # Type-safe prepared statement data layer
│   │   ├── crypto.ts           # Argon2id + bcrypt fallback + dummyVerify
│   │   ├── middleware/         # requireAuth, CSRF double-submit protection
│   │   ├── routes/auth.ts      # Auth endpoints with rate-limiting & lockout
│   │   ├── tests/auth.test.ts  # Vitest integration test suite
│   │   └── seed.ts             # Demo data populator
├── shared/                     # Shared cross-cutting code
│   ├── const.ts                # Synchronized security constants (stats counters)
│   └── validation.ts           # Shared Zod schemas (password rules, auth inputs)
├── DECISIONS.md                # Architectural Decision Records & Threat Model
└── README.md                   # System documentation and operational guide
```
