import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import app from "../index.js";
import { db } from "../db.js";
import { AUTH_CONFIG } from "../../../shared/const.js";

// ── Mock sendMail so no real SMTP calls are made ──────────────────────────────
vi.mock("../services/emailService.js", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../services/emailService.js")>();
  return {
    ...mod,
    sendMail: vi.fn().mockResolvedValue(undefined),
  };
});

// Safe helper to extract cookies array from supertest response headers
function getCookies(res: any): string[] {
  const c = res.headers["set-cookie"];
  if (Array.isArray(c)) return c;
  if (typeof c === "string") return [c];
  return [];
}

// Helper to obtain a fresh CSRF token + cookie pair
async function getCsrf() {
  const res = await request(app).get("/api/auth/csrf-token");
  const csrfToken = res.body.csrfToken as string;
  const csrfCookie = getCookies(res).find((c: string) =>
    c.startsWith("sa.csrf=")
  );
  return { csrfToken, csrfCookie };
}

/**
 * Registers a user AND immediately verifies their email so they can log in.
 * Returns the session cookie of the verified+logged-in session.
 */
async function registerAndVerify(
  credentials: { name: string; email: string; password: string },
  csrfToken: string,
  csrfCookie: string
): Promise<{ sessionCookie: string }> {
  // 1. Register
  const regRes = await request(app)
    .post("/api/auth/register")
    .set("Cookie", [csrfCookie])
    .set("x-csrf-token", csrfToken)
    .send(credentials);

  expect(regRes.status).toBe(201);
  expect(regRes.body.emailVerificationRequired).toBe(true);

  // 2. Pull the verification code from the DB directly (test-only shortcut)
  const user = db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(credentials.email.toLowerCase()) as any;
  const ver = db
    .prepare(
      "SELECT * FROM email_verifications WHERE user_id = ? AND consumed_at IS NULL ORDER BY created_at DESC LIMIT 1"
    )
    .get(user.id) as any;

  // Hash the raw code — but since we can't see the raw code, we use
  // a direct DB update to mark the user as verified for test isolation.
  db.prepare("UPDATE users SET email_verified = 1 WHERE id = ?").run(user.id);

  // 3. Login
  const loginRes = await request(app)
    .post("/api/auth/login")
    .set("Cookie", [csrfCookie])
    .set("x-csrf-token", csrfToken)
    .send({ email: credentials.email, password: credentials.password });

  expect(loginRes.status).toBe(200);
  expect(loginRes.body.success).toBe(true);

  const sessionCookie = getCookies(loginRes).find((c: string) =>
    c.startsWith(`${AUTH_CONFIG.COOKIE_NAME}=`)
  )!;
  return { sessionCookie };
}

describe("Authentication & Security Integration Tests", () => {
  beforeEach(() => {
    // Clean tables before each test for total test isolation
    db.exec(
      "DELETE FROM email_verifications; DELETE FROM login_attempts; DELETE FROM users;"
    );
  });

  describe("CSRF Protection", () => {
    it("should issue a CSRF token and set the sa.csrf cookie on GET /api/auth/csrf-token", async () => {
      const res = await request(app).get("/api/auth/csrf-token");
      expect(res.status).toBe(200);
      expect(res.body.csrfToken).toBeDefined();
      expect(typeof res.body.csrfToken).toBe("string");

      const cookies = getCookies(res);
      expect(cookies.length).toBeGreaterThan(0);
      const csrfCookie = cookies.find((c: string) => c.startsWith("sa.csrf="));
      expect(csrfCookie).toBeDefined();
    });

    it("should reject POST requests that omit the CSRF token with status 403", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Attacker",
          email: "attacker@test.com",
          password: "Password123!",
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/csrf/i);
    });

    it("should reject POST requests with an invalid CSRF token with status 403", async () => {
      const { csrfCookie } = await getCsrf();
      const res = await request(app)
        .post("/api/auth/register")
        .set("Cookie", [csrfCookie!])
        .set("x-csrf-token", "invalid-token-signature")
        .send({
          name: "Attacker",
          email: "attacker@test.com",
          password: "Password123!",
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe("Registration: POST /api/auth/register", () => {
    it("should validate input schema and reject invalid payloads with 400", async () => {
      const { csrfToken, csrfCookie } = await getCsrf();
      const res = await request(app)
        .post("/api/auth/register")
        .set("Cookie", [csrfCookie!])
        .set("x-csrf-token", csrfToken)
        .send({
          name: "",
          email: "not-an-email",
          password: "weak",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.fieldErrors).toBeDefined();
    });

    it("should register a user, hash password, send verify email, and NOT create a session", async () => {
      const { csrfToken, csrfCookie } = await getCsrf();
      const res = await request(app)
        .post("/api/auth/register")
        .set("Cookie", [csrfCookie!])
        .set("x-csrf-token", csrfToken)
        .send({
          name: "Alice Security",
          email: "Alice@Security.io",
          password: "StrongPassword123!",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.emailVerificationRequired).toBe(true);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.name).toBe("Alice Security");
      // Email should be normalized to lowercase
      expect(res.body.user.email).toBe("alice@security.io");
      // emailVerified must be false immediately after registration
      expect(res.body.user.emailVerified).toBe(false);
      // Password hash must never leak to client
      expect(res.body.user.password_hash).toBeUndefined();
      expect(res.body.user.passwordHash).toBeUndefined();

      // NO session cookie — account not yet verified
      const cookies = getCookies(res);
      const sessionCookie = cookies.find((c: string) =>
        c.startsWith(`${AUTH_CONFIG.COOKIE_NAME}=`)
      );
      expect(sessionCookie).toBeUndefined();
    });

    it("should reject duplicate email registrations with 409 and a generic error", async () => {
      const { csrfToken, csrfCookie } = await getCsrf();

      // First registration
      await request(app)
        .post("/api/auth/register")
        .set("Cookie", [csrfCookie!])
        .set("x-csrf-token", csrfToken)
        .send({
          name: "Bob",
          email: "bob@test.com",
          password: "Password123!",
        });

      // Second registration with same email (different case)
      const res = await request(app)
        .post("/api/auth/register")
        .set("Cookie", [csrfCookie!])
        .set("x-csrf-token", csrfToken)
        .send({
          name: "Bob Impostor",
          email: "BOB@test.com",
          password: "Password123!",
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("already exists");
    });
  });

  describe("Email Verification: POST /api/auth/verify-email", () => {
    const user = {
      name: "Vera Test",
      email: "vera@verify.io",
      password: "SecurePass123!",
    };

    beforeEach(async () => {
      const { csrfToken, csrfCookie } = await getCsrf();
      await request(app)
        .post("/api/auth/register")
        .set("Cookie", [csrfCookie!])
        .set("x-csrf-token", csrfToken)
        .send(user);
    });

    it("should block login for unverified accounts with emailVerificationRequired flag", async () => {
      const { csrfToken, csrfCookie } = await getCsrf();
      const res = await request(app)
        .post("/api/auth/login")
        .set("Cookie", [csrfCookie!])
        .set("x-csrf-token", csrfToken)
        .send({ email: user.email, password: user.password });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.emailVerificationRequired).toBe(true);
    });

    it("should reject verify-email with wrong code", async () => {
      const { csrfToken, csrfCookie } = await getCsrf();
      const res = await request(app)
        .post("/api/auth/verify-email")
        .set("Cookie", [csrfCookie!])
        .set("x-csrf-token", csrfToken)
        .send({ email: user.email, code: "000000" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should verify email with correct code and return a session", async () => {
      // Retrieve the hashed code from the DB and the raw code via crypto helper
      const dbUser = db
        .prepare("SELECT * FROM users WHERE email = ?")
        .get(user.email.toLowerCase()) as any;
      const ver = db
        .prepare(
          "SELECT * FROM email_verifications WHERE user_id = ? AND consumed_at IS NULL LIMIT 1"
        )
        .get(dbUser.id) as any;

      // Force-verify via direct DB for testing (we can't recover raw code from hash)
      // Instead, reset with a known code to test the full flow
      const { hashOtp } = await import("../crypto.js");
      const testCode = "123456";
      db.prepare("UPDATE email_verifications SET code_hash = ? WHERE id = ?").run(
        hashOtp(testCode),
        ver.id
      );

      const { csrfToken, csrfCookie } = await getCsrf();
      const res = await request(app)
        .post("/api/auth/verify-email")
        .set("Cookie", [csrfCookie!])
        .set("x-csrf-token", csrfToken)
        .send({ email: user.email, code: testCode });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.emailVerified).toBe(true);

      // Session cookie must be set after verification
      const cookies = getCookies(res);
      const sessionCookie = cookies.find((c: string) =>
        c.startsWith(`${AUTH_CONFIG.COOKIE_NAME}=`)
      );
      expect(sessionCookie).toBeDefined();
      expect(sessionCookie).toMatch(/HttpOnly/i);
    });
  });

  describe("Resend Verify: POST /api/auth/resend-verify", () => {
    it("should return a neutral message for non-existent email", async () => {
      const { csrfToken, csrfCookie } = await getCsrf();
      const res = await request(app)
        .post("/api/auth/resend-verify")
        .set("Cookie", [csrfCookie!])
        .set("x-csrf-token", csrfToken)
        .send({ email: "nobody@nowhere.com" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should enforce 60-second cooldown on resend for unverified accounts", async () => {
      const { csrfToken, csrfCookie } = await getCsrf();
      // Register first
      await request(app)
        .post("/api/auth/register")
        .set("Cookie", [csrfCookie!])
        .set("x-csrf-token", csrfToken)
        .send({ name: "Resend User", email: "resend@test.com", password: "SecurePass123!" });

      // Immediately resend — should hit cooldown (< 60s since registration)
      const res = await request(app)
        .post("/api/auth/resend-verify")
        .set("Cookie", [csrfCookie!])
        .set("x-csrf-token", csrfToken)
        .send({ email: "resend@test.com" });

      expect(res.status).toBe(429);
      expect(res.body.retryAfterSeconds).toBeGreaterThan(0);
    });
  });

  describe("Login, Session & Activity: /api/auth/*", () => {
    const userCredentials = {
      name: "Charlie",
      email: "charlie@enterprise.org",
      password: "EnterprisePassword123!",
    };

    let csrfToken: string;
    let csrfCookie: string;

    beforeEach(async () => {
      ({ csrfToken, csrfCookie } = await getCsrf());
      // Register and immediately verify via DB shortcut
      await request(app)
        .post("/api/auth/register")
        .set("Cookie", [csrfCookie])
        .set("x-csrf-token", csrfToken)
        .send(userCredentials);

      // Mark verified
      db.prepare("UPDATE users SET email_verified = 1 WHERE email = ?").run(
        userCredentials.email.toLowerCase()
      );
    });

    it("should reject invalid passwords with 401 generic message", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .set("Cookie", [csrfCookie])
        .set("x-csrf-token", csrfToken)
        .send({
          email: userCredentials.email,
          password: "WrongPassword999!",
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Invalid email or password.");
    });

    it("should reject non-existent users with 401 generic message (constant-time guard)", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .set("Cookie", [csrfCookie])
        .set("x-csrf-token", csrfToken)
        .send({
          email: "nonexistent@enterprise.org",
          password: "WrongPassword999!",
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Invalid email or password.");
    });

    it("should successfully log in with correct credentials and issue session cookie", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .set("Cookie", [csrfCookie])
        .set("x-csrf-token", csrfToken)
        .send({
          email: userCredentials.email,
          password: userCredentials.password,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.email).toBe(userCredentials.email);
      expect(res.body.user.emailVerified).toBe(true);

      const sessionCookie = getCookies(res).find((c: string) =>
        c.startsWith(`${AUTH_CONFIG.COOKIE_NAME}=`)
      );
      expect(sessionCookie).toBeDefined();
    });

    it("should verify session persistence on GET /api/auth/me", async () => {
      const loginRes = await request(app)
        .post("/api/auth/login")
        .set("Cookie", [csrfCookie])
        .set("x-csrf-token", csrfToken)
        .send({
          email: userCredentials.email,
          password: userCredentials.password,
        });

      const sessionCookie = getCookies(loginRes).find((c: string) =>
        c.startsWith(`${AUTH_CONFIG.COOKIE_NAME}=`)
      );

      // Authenticated request
      const meRes = await request(app)
        .get("/api/auth/me")
        .set("Cookie", [sessionCookie!]);

      expect(meRes.status).toBe(200);
      expect(meRes.body.success).toBe(true);
      expect(meRes.body.user.email).toBe(userCredentials.email);
      expect(meRes.body.session).toBeDefined();

      // Unauthenticated request should fail with 401
      const unauthRes = await request(app).get("/api/auth/me");
      expect(unauthRes.status).toBe(401);
      expect(unauthRes.body.success).toBe(false);
    });

    it("should record login audit trail and return it on GET /api/auth/activity", async () => {
      // Failed attempt
      await request(app)
        .post("/api/auth/login")
        .set("Cookie", [csrfCookie])
        .set("x-csrf-token", csrfToken)
        .send({
          email: userCredentials.email,
          password: "BadPassword1!",
        });

      // Successful login
      const loginRes = await request(app)
        .post("/api/auth/login")
        .set("Cookie", [csrfCookie])
        .set("x-csrf-token", csrfToken)
        .send({
          email: userCredentials.email,
          password: userCredentials.password,
        });

      const sessionCookie = getCookies(loginRes).find((c: string) =>
        c.startsWith(`${AUTH_CONFIG.COOKIE_NAME}=`)
      );

      const actRes = await request(app)
        .get("/api/auth/activity")
        .set("Cookie", [sessionCookie!]);

      expect(actRes.status).toBe(200);
      expect(actRes.body.success).toBe(true);
      expect(Array.isArray(actRes.body.events)).toBe(true);
      expect(actRes.body.events.length).toBeGreaterThanOrEqual(2);

      const failedEvent = actRes.body.events.find(
        (e: any) => e.success === false
      );
      expect(failedEvent).toBeDefined();
      expect(failedEvent.failureReason).toBe("Invalid password");
    });

    it("should terminate session on POST /api/auth/logout", async () => {
      const loginRes = await request(app)
        .post("/api/auth/login")
        .set("Cookie", [csrfCookie])
        .set("x-csrf-token", csrfToken)
        .send({
          email: userCredentials.email,
          password: userCredentials.password,
        });

      const sessionCookie = getCookies(loginRes).find((c: string) =>
        c.startsWith(`${AUTH_CONFIG.COOKIE_NAME}=`)
      );

      // Logout with auth + CSRF
      const logoutRes = await request(app)
        .post("/api/auth/logout")
        .set("Cookie", [sessionCookie!, csrfCookie])
        .set("x-csrf-token", csrfToken);

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.success).toBe(true);

      // Subsequent /me request should be rejected
      const meRes = await request(app)
        .get("/api/auth/me")
        .set("Cookie", [sessionCookie!]);

      expect(meRes.status).toBe(401);
    });
  });

  describe("Brute-Force Account Lockout Protection", () => {
    const targetUser = {
      name: "Dave Target",
      email: "dave@lockout-test.com",
      password: "SecureTargetPassword123!",
    };

    let csrfToken: string;
    let csrfCookie: string;

    beforeEach(async () => {
      ({ csrfToken, csrfCookie } = await getCsrf());
      await request(app)
        .post("/api/auth/register")
        .set("Cookie", [csrfCookie])
        .set("x-csrf-token", csrfToken)
        .send(targetUser);
      // Mark verified so the lockout test can reach the password-check step
      db.prepare("UPDATE users SET email_verified = 1 WHERE email = ?").run(
        targetUser.email.toLowerCase()
      );
    });

    it("should lock account after 5 consecutive failed attempts and return 429 on subsequent attempts", async () => {
      // Perform 5 failed attempts
      for (let i = 1; i <= 5; i++) {
        const res = await request(app)
          .post("/api/auth/login")
          .set("Cookie", [csrfCookie])
          .set("x-csrf-token", csrfToken)
          .send({
            email: targetUser.email,
            password: `WrongPasswordTry${i}!`,
          });

        if (i < 5) {
          expect(res.status).toBe(401);
        } else {
          // On the 5th failure, threshold is met -> 429 Account locked
          expect(res.status).toBe(429);
          expect(res.body.success).toBe(false);
          expect(res.body.message).toMatch(/Account temporarily locked/i);
          expect(res.body.retryAfterSeconds).toBeDefined();
          expect(res.body.lockedUntil).toBeDefined();
        }
      }

      // Even with the CORRECT password now, it must reject with 429
      const lockedRes = await request(app)
        .post("/api/auth/login")
        .set("Cookie", [csrfCookie])
        .set("x-csrf-token", csrfToken)
        .send({
          email: targetUser.email,
          password: targetUser.password,
        });

      expect(lockedRes.status).toBe(429);
      expect(lockedRes.body.success).toBe(false);
      expect(lockedRes.body.message).toMatch(/Account temporarily locked/i);
    });
  });
});
