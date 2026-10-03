# Architecture & Security Decision Records (DECISIONS.md)

This document formalizes the architectural choices, security trade-offs, and threat modeling for the **SecureAuth** authentication platform.

---

## 1. Password Hashing Choice

### Decision: Argon2id (with transparent bcrypt cost 12 fallback)
- **Primary Algorithm**: **Argon2id** via `@node-rs/argon2` (Rust-backed SIMD binding).
- **Parameters**:
  - Memory cost: `65,536 KiB` (64 MiB) — OWASP recommended minimum for defense against GPU/ASIC attacks.
  - Time cost (iterations): `3`.
  - Parallelism: `1` thread.
- **Fallback Mechanism**: In environments where native Rust binaries cannot load, the system transparently falls back to pure JavaScript `bcryptjs` with a work factor of **12** (4,096 iterations).
- **Anti-Enumeration Guard (`dummyVerify`)**: When a login attempt targets an email address that does not exist in the database, the server runs a synthetic hash verification against a dummy digest. This ensures that the response timing remains identical whether an account exists or not, preventing timing-based user enumeration.

---

## 2. Session Management vs. JWT

### Decision: Stateful Server-Side Sessions with Opaque Session IDs
- **Rationale**:
  - **Instant Revocation**: Stateless JWTs cannot be revoked immediately upon logout or password reset without maintaining a distributed denylist (which defeats the purpose of statelessness). Server-side sessions (`express-session` / SQLite) permit instantaneous revocation via `req.session.destroy()`.
  - **Session Fixation Prevention**: On every privilege transition (successful login or registration), `req.session.regenerate()` is invoked. This destroys the previous unauthenticated session ID and generates a cryptographically distinct ID.
  - **Payload Privacy**: User metadata and authorization state stay on the server rather than being serialized into client-decodable JWT payloads.
  - **Bandwidth Efficiency**: Only a compact opaque identifier is transmitted, unlike multi-kilobyte signed JWT tokens.

---

## 3. Cookie Flags & Defense-in-Depth

### Decision: HttpOnly, SameSite=Lax, Secure Cookie (`sa.sid`)
- **`HttpOnly: true`**: Prohibits any client-side JavaScript from accessing the session cookie via `document.cookie`. This neutralizes token theft even in the event of an XSS vulnerability.
- **`SameSite: "lax"`**: Instructs modern browsers to withhold the session cookie on cross-site sub-resource requests (e.g. cross-site `<img>`, `<iframe>`, `fetch`), eliminating CSRF on state-changing requests while enabling natural top-level incoming link navigation.
- **`Secure: true` (Production)**: Ensures the browser only transmits the cookie over encrypted TLS/HTTPS connections, preventing eavesdropping and man-in-the-middle interception over unencrypted networks.
- **`Rolling: true` & `maxAge: 24h`**: Session lifetime rolls with active user interaction and expires automatically after inactivity.
- **CSRF Token Cookie (`sa.csrf`)**: The CSRF token is issued via the Double-Submit Cookie pattern using `csrf-csrf`. The client reads the CSRF token and submits it in the `x-csrf-token` header, verifying that the request originates from our legitimate origin.

---

## 4. Input Validation & Type Integrity

### Decision: Shared Zod Schema Single Source of Truth
- **Single Source of Truth**: `shared/validation.ts` defines all validation schemas (`registerSchema`, `loginSchema`, `forgotPasswordSchema`, `resetPasswordSchema`) used by both the React frontend and Express backend.
- **Granular Password Policy**:
  - Minimum length: 8 characters (`AUTH_CONFIG.PASSWORD_MIN_LENGTH`).
  - At least one uppercase letter (`[A-Z]`).
  - At least one lowercase letter (`[a-z]`).
  - At least one numeric digit (`[0-9]`).
  - At least one symbol (`[^A-Za-z0-9]`).
- **Data Normalization**: Emails are strictly trimmed and normalized to lowercase (`email.toLowerCase().trim()`) before validation, uniqueness checks, and database storage.
- **Strict Payload Filtering**: Extra or unexpected properties are stripped to prevent mass-assignment vulnerabilities.

---

## 5. Brute-Force & Account Lockout Strategy

### Decision: Two-Tier Defense (IP Rate Limiting + Per-Account Freezing)
1. **Network Layer (IP Throttling)**:
   - Implemented via `express-rate-limit` on `/api/auth/*`.
   - General auth routes: 10 requests per 15-minute window per IP.
   - Registration: 5 requests per hour per IP.
   - Password reset: 3 requests per 30 minutes per IP.
2. **Account Layer (Credential Stuffing & Lockout)**:
   - Tracks failed attempts per account in the database (`users.failed_attempts`).
   - After **5 consecutive failed attempts** (`AUTH_CONFIG.MAX_FAILED_LOGIN_ATTEMPTS`), the account enters a **15-minute temporary freeze** (`AUTH_CONFIG.LOCKOUT_DURATION_MINUTES`).
   - The server responds with `HTTP 429 Too Many Requests` containing `retryAfterSeconds` and `lockedUntil`.
   - Even if the attacker subsequently guesses the correct password, authentication is rejected until the lockout window elapses.
   - Successful authentication resets `failed_attempts` to 0.

---

## 6. Error-Message & Anti-Enumeration Policy

### Decision: Uniform Generic Responses Across All Authentication Endpoints
- **OWASP Identity Disclosure Compliance**:
  - Login failure (wrong password, non-existent user, locked account) returns:
    `"Invalid email or password."` (or timed lockout alert).
  - Registration duplicate email: Generic conflict notice that does not reveal internal identifiers.
  - Forgot password request: Always returns `"If an account with that email exists, reset instructions have been sent."`, irrespective of whether the email is present in the database.
- **Public User Sanitization**: The repository layer strips `password_hash`, `reset_token_hash`, and internal lockout fields via `toPublicUser()`.

---

## 7. Threat Model (OWASP Top 10: 2021 Mapping)

| OWASP Vulnerability | Risk Scenario | Mitigation in SecureAuth |
|---|---|---|
| **A01: Broken Access Control** | Unauthorized access to user dashboards or audit logs | `requireAuth` middleware verifies active session cookie; queries scope data strictly to `req.session.userId`. |
| **A02: Cryptographic Failures** | Compromised password hashes from offline GPU cracking | Argon2id (64 MiB memory cost, 3 iterations) + bcrypt (12 rounds) fallback; SHA-256 for single-use reset tokens; secure random generation via `crypto.randomBytes(32)`. |
| **A03: Injection** | SQL injection via email or name parameters | Parameterized SQL prepared statements in `better-sqlite3` (`stmts.findByEmail.get(?)`); strict Zod schema parsing. |
| **A04: Insecure Design** | Credential stuffing and automated password guessing | Dual-tier defense: IP-based `express-rate-limit` + 5-failure/15-minute per-account lockout; constant-time dummy verification. |
| **A05: Security Misconfiguration** | Clickjacking, MIME sniffing, data leakage | `helmet()` enabled for security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`); CORS restricted to frontend origin with `credentials: true`. |
| **A07: Identification & Auth Failures** | Session hijacking, session fixation, token theft | `HttpOnly` and `SameSite=Lax` cookies; session destruction on logout; `session.regenerate()` on login/register; no sensitive state in `localStorage`. |
| **A08: Software & Data Integrity** | Cross-Site Request Forgery (CSRF) on state-changing actions | Double-Submit Cookie pattern via `csrf-csrf`: `sa.csrf` cookie paired with validated `x-csrf-token` header. |
| **A09: Security Logging & Monitoring** | Undetected unauthorized access attempts | `login_attempts` table logs every authentication event (IP, User-Agent, timestamp, success status, failure reason), surfaced to users on the Activity Dashboard. |

---

## 8. Rejected / Revised Approaches

### Rejected Approach: Storing JWT Access Tokens in Browser `localStorage` / `sessionStorage`
- **Initial Consideration**: Early implementations often store JWT tokens in `localStorage` or `sessionStorage` for convenient client-side retrieval and header injection.
- **Why It Was Rejected**:
  - Any client-side XSS vulnerability (including malicious third-party dependencies or injected scripts) has unrestricted read access to `window.localStorage`.
  - Exfiltrated JWT tokens can be replayed from arbitrary devices for the duration of their lifetime without the ability for the server to invalidate them.
- **Adopted Solution**:
  - Switched entirely to **server-side session storage** with opaque session IDs placed exclusively in an **`HttpOnly`**, **`SameSite=Lax`**, **`Secure`** cookie.
  - Paired with a **Double-Submit CSRF Cookie protection** (`csrf-csrf`) so that browser automation or cross-origin requests cannot forge mutating actions.

---

## 9. Secret Management: SMTP & Sensitive Credentials in Environment Variables Only

### Decision: Isolate SMTP Credentials Exclusively in Environment Variables
All mail transport configuration (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`) is strictly resolved from runtime environment variables (`process.env`) and explicitly barred from repository tracking via `.gitignore`.

### Architectural & Security Rationale:
1. **The 12-Factor App Compliance (Factor III — Config)**:
   - Credentials vary significantly between development workstations (local mock/testing or dedicated developer Gmail accounts), staging environments (e.g. Mailtrap or Amazon SES sandbox), and production clusters (hardened enterprise relays with dedicated IP reputations).
   - Injecting configuration via environment variables ensures identical code builds can be deployed across any infrastructure without code modifications.

2. **Zero-Secret Source Code & Defense-in-Depth**:
   - Committing credentials into source control—even in private repositories—presents a primary vector for catastrophic compromise via compromised developer machines, inadvertent public forks, open pull requests, CI/CD artifact exposures, and mirror synchronization.
   - Enforcing `.gitignore` on all `.env` files guarantees secrets remain ephemeral to the host executing the service.

3. **Immediate Revocation & Zero-Downtime Rotation**:
   - In the event of suspected credential compromise (such as a compromised Google App Password or compromised relay host), credentials can be rotated instantly in host environment managers or container orchestration configurations (e.g., Kubernetes Secrets, AWS Secrets Manager, Doppler, HashiCorp Vault) without rebuilding or recompiling the application.

4. **Client & Process Isolation**:
   - Frontend bundlers (Vite/webpack) automatically bundle code imported by client packages. Keeping SMTP services localized to `server/src/services/emailService.ts` and parameterized via server `process.env` ensures zero leakage of mail secrets to the browser or public client distribution bundles.

5. **Production Logging Hygiene**:
   - `emailService` and the auth routes implement strict logging boundaries: `SMTP_PASS` and raw verification OTP codes are strictly suppressed from stdout/stderr in production mode (`NODE_ENV === "production"`). Console fallback of OTP codes is permitted exclusively when `NODE_ENV === "development"` to ensure rapid local developer workflows without compromising production security posture.

---

## 10. Centralized Transactional Email & Security Alert Architecture

### Decision: Encapsulate All Mail Transport into a Single Central Service (`emailService.ts`)

- **Single Point of Responsibility**:
  `server/src/services/emailService.ts` is the only file in the codebase permitted to import or interface with `nodemailer`. All higher-level business logic (auth routes, security events, audit pipelines) interact with mail delivery strictly through a single strongly-typed contract:
  ```ts
  sendMail({ to, subject, template, data })
  ```

- **Shared Visual & Accessible Design System**:
  Every email template in `server/src/emails/` renders through a unified layout:
  - **Header**: Deep forest emerald `#0B2925` with the official SecureAuth brandmark.
  - **Accent**: Fresh mint `#A7F3D0` for badges, borders, and OTP container highlights.
  - **Body Container**: Warm off-white `#F8F5F3` with high-contrast text (`#1C2422`).
  - **Mandatory Footer**: Universal automated disclaimer *"This is an automated security email from SecureAuth. If you did not make this request, please review your account activity immediately."*
  - **Dual-Delivery (Plain-Text Fallback)**: Every HTML template is paired with a synchronous plain-text generator (`*Text(data)`). This ensures screen readers, text-only mail clients, and automated terminal tools receive complete, accessible security instructions without CSS degradation.

- **Non-Blocking Fire-and-Forget Semantics (`void sendMail(...)`)**:
  - Outbound email operations are intentionally executed asynchronously without `await` in HTTP handlers.
  - **Fault Isolation**: SMTP timeout, relay downtime, or network glitches are caught and logged server-side; they never crash the Express request lifecycle, trigger 500 errors, or leak infrastructure topology to external users.
  - **Latency Neutrality**: Client-facing response times remain sub-millisecond rather than waiting for third-party SMTP round trips (typically 500ms - 3000ms).

- **Mandatory Registration Email Verification Gate**:
  - Accounts are registered in an unverified state (`users.email_verified = 0`).
  - **Login Blocked**: Authentication attempts for unverified accounts immediately return `HTTP 403 Forbidden` with `{ success: false, emailVerificationRequired: true }` and descriptive guidance.
  - **Rate-Limited Resend**: `POST /api/auth/resend-verify` enforces a 60-second cooldown per account and strict IP throttling, returning generic neutral responses to preserve anti-enumeration standards.
  - **Constant-Time Verification Code Hashing**: 6-digit verification codes are stored as HMAC-SHA256 digests (`email_verifications.code_hash`) with automatic expiration (15 minutes) and attempt exhaustion guards (max 5 attempts).

- **Per-Recipient Rate Limiting**:
  - `emailService` maintains an in-memory sliding window cache tracking recipient email addresses (`EMAIL_RATE_LIMIT = 5` per `EMAIL_RATE_WINDOW_MS = 1h`).
  - Prevents attackers from using registration or reset endpoints to mail-bomb innocent third parties. Excess requests are silently dropped and flagged in server logs.

- **Automated Lifecycle Security Alerts**:
  - **`passwordChanged`**: Dispatched immediately upon successful password reset, recording timestamp and IP.
  - **`newLoginAlert`**: Dispatched when successful authentication originates from an unrecognized IP address or user-agent fingerprint.
  - **`twoFactorEnabled` / `twoFactorDisabled`**: Real-time notifications on multi-factor status transitions.
  - **`accountLocked`**: Dispatched when 5 consecutive invalid credentials trigger a 15-minute freeze.
