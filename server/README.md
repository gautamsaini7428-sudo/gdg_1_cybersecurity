# SecureAuth Backend Server (Node.js + Express + TypeScript)

Production-grade authentication and security service powering the SecureAuth UI.

## Features & Architecture

- **Database Layer**: SQLite via `better-sqlite3` with WAL mode and foreign key enforcement. Schema includes:
  - `users`: Accounts, password hashes, lockout metadata, failed attempt counter, reset tokens.
  - `login_attempts`: Complete security audit trail (IP, user agent, timestamp, success status, failure reason).
- **Password Hashing**: OWASP-recommended **Argon2id** (`@node-rs/argon2` with 64 MiB memory cost, 3 iterations, 1 parallelism) with automatic fallback to `bcryptjs` (cost factor 12).
- **Constant-Time Verification**: Prevents user enumeration via `dummyVerify()` when account does not exist.
- **Session Management**: Server-side session ID stored in `HttpOnly`, `SameSite=Lax`, `Secure` (in production) cookies (`sa.sid`). Never stored in `localStorage`.
- **CSRF Protection**: Double-Submit Cookie pattern via `csrf-csrf` (`sa.csrf` cookie + `x-csrf-token` header).
- **Brute-Force & Lockout Protection**:
  - IP-level rate limiting via `express-rate-limit`.
  - Per-account lockout after 5 consecutive failed attempts (15-minute freeze), synchronized with `shared/const.ts`.
- **Security Headers**: Standardized OWASP HTTP security headers via `helmet`.
- **Validation**: Shared Zod schemas (`shared/validation.ts`) ensuring end-to-end type safety between client and server.

---

## Getting Started

### 1. Install Dependencies
```bash
cd server
npm install
```

### 2. Seed Demo Accounts & Audit History
```bash
npm run seed
```
Creates:
- `alex@secureauth.io` (Password: `StrongPassword123!`)
- `auditor@enterprise.corp` (Password: `EnterpriseAudit999!`)

### 3. Run Development Server
```bash
npm run dev
```
Starts Express server on `http://localhost:5000`.

### 4. Run Test Suite
```bash
npm test
```
Executes all 13 unit and integration tests (CSRF, registration, login, session persistence, account lockout, activity audit trail).

---

## Manual Testing via cURL

### Step 1: Obtain CSRF Token & Cookie
```bash
# Save cookies to cookies.txt and extract token
curl -c cookies.txt -s http://localhost:5000/api/auth/csrf-token
```
Sample response:
```json
{"csrfToken":"<token>"}
```

### Step 2: Register a New User
```bash
curl -b cookies.txt -c cookies.txt -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: <CSRF_TOKEN>" \
  -d '{"name":"Alice Tester","email":"alice@example.com","password":"SecurePassword123!"}'
```

### Step 3: Login
```bash
curl -b cookies.txt -c cookies.txt -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: <CSRF_TOKEN>" \
  -d '{"email":"alice@example.com","password":"SecurePassword123!"}'
```

### Step 4: Verify Current Session (`/api/auth/me`)
```bash
curl -b cookies.txt http://localhost:5000/api/auth/me
```

### Step 5: View Login Activity & Audit Logs (`/api/auth/activity`)
```bash
curl -b cookies.txt http://localhost:5000/api/auth/activity
```

### Step 6: Trigger Account Lockout (5 Failed Attempts)
```bash
# Repeat 5 times with incorrect password:
for i in {1..5}; do
  curl -b cookies.txt -c cookies.txt -X POST http://localhost:5000/api/auth/login \
    -H "Content-Type: application/json" \
    -H "x-csrf-token: <CSRF_TOKEN>" \
    -d '{"email":"alice@example.com","password":"WrongPassword!"}'
  echo ""
done

# 6th attempt returns HTTP 429 Account temporarily locked:
curl -b cookies.txt -c cookies.txt -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: <CSRF_TOKEN>" \
  -d '{"email":"alice@example.com","password":"SecurePassword123!"}'
```

### Step 7: Logout
```bash
curl -b cookies.txt -c cookies.txt -X POST http://localhost:5000/api/auth/logout \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: <CSRF_TOKEN>"
```

### Step 8: Password Reset Flow
```bash
# Request reset
curl -b cookies.txt -c cookies.txt -X POST http://localhost:5000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: <CSRF_TOKEN>" \
  -d '{"email":"alice@example.com"}'

# Check console for the reset token printed in non-production mode, then reset:
curl -b cookies.txt -c cookies.txt -X POST http://localhost:5000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: <CSRF_TOKEN>" \
  -d '{"email":"alice@example.com","token":"<RESET_TOKEN>","newPassword":"BrandNewPassword123!"}'
```
