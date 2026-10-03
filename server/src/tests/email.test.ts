/**
 * Email service & template tests
 *
 * Coverage
 * ────────
 *   1. Each template renders correctly (HTML palette + plain-text)
 *   2. sendMail dispatches the correct template
 *   3. verifyEmail end-to-end via the /verify-email endpoint
 *   4. Security alert emails fire on the right lifecycle events
 *   5. Per-recipient rate limit blocks the 6th email
 *   6. Forgot-password route neutral response
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import app from "../index.js";
import { db } from "../db.js";
import {
  verifySmtp,
  sendMail,
  setTransporter,
  checkEmailRateLimit,
  resetEmailRateStore,
} from "../services/emailService.js";

// ── Template renderers (tested in isolation) ──────────────────────────────────
import { verifyEmailHtml, verifyEmailText } from "../emails/verifyEmail.js";
import { resetOtpHtml, resetOtpText } from "../emails/resetOtp.js";
import { passwordChangedHtml, passwordChangedText } from "../emails/passwordChanged.js";
import { newLoginAlertHtml, newLoginAlertText } from "../emails/newLoginAlert.js";
import {
  twoFactorEnabledHtml,
  twoFactorEnabledText,
  twoFactorDisabledHtml,
  twoFactorDisabledText,
} from "../emails/twoFactorStatus.js";
import { accountLockedHtml, accountLockedText } from "../emails/accountLocked.js";
import { hashOtp } from "../crypto.js";
import { AUTH_CONFIG } from "../../../shared/const.js";

// Palette constants that every email must include
const PALETTE = {
  header: "#0B2925",
  accent: "#A7F3D0",
  background: "#F8F5F3",
};
const FOOTER_MARKER = "This is an automated security email";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getCookies(res: any): string[] {
  const c = res.headers["set-cookie"];
  if (Array.isArray(c)) return c;
  if (typeof c === "string") return [c];
  return [];
}

async function getCsrf() {
  const res = await request(app).get("/api/auth/csrf-token");
  return {
    csrfToken: res.body.csrfToken as string,
    csrfCookie: getCookies(res).find((c) => c.startsWith("sa.csrf="))!,
  };
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe("Email Service & Templates", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
    setTransporter(null);
    resetEmailRateStore();
    db.exec(
      "DELETE FROM email_verifications; DELETE FROM login_attempts; DELETE FROM users;"
    );
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // ── 1. SMTP verification ───────────────────────────────────────────────────

  describe("SMTP Verification", () => {
    it("should log failure and return ok: false if credentials are missing", async () => {
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const result = await verifySmtp();

      expect(result.ok).toBe(false);
      expect(result.message).toContain("Missing credentials");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("SMTP failed:")
      );
    });

    it("should report SMTP ready when verify succeeds", async () => {
      process.env.SMTP_HOST = "smtp.mock.com";
      process.env.SMTP_USER = "mock@mock.com";
      process.env.SMTP_PASS = "mock-secret";

      const mockVerify = vi.fn().mockResolvedValue(true);
      setTransporter({
        verify: mockVerify,
        sendMail: vi.fn(),
      } as any);

      const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const result = await verifySmtp();

      expect(result.ok).toBe(true);
      expect(consoleLogSpy).toHaveBeenCalledWith("SMTP ready");
    });
  });

  // ── 2. Template rendering ──────────────────────────────────────────────────

  describe("Template: verifyEmail", () => {
    it("should include all palette colors, the 6-digit code, expiry, and footer", () => {
      const html = verifyEmailHtml({ code: "123456", minutesValid: 30 });
      expect(html).toContain(PALETTE.header);
      expect(html).toContain(PALETTE.accent);
      expect(html).toContain(PALETTE.background);
      expect(html).toContain("123456");
      expect(html).toContain("30 minutes");
      expect(html).toContain(FOOTER_MARKER);
    });

    it("plain-text fallback should contain the code and expiry", () => {
      const text = verifyEmailText({ code: "654321", minutesValid: 30 });
      expect(text).toContain("654321");
      expect(text).toContain("30 minutes");
      expect(text).toContain(FOOTER_MARKER);
    });
  });

  describe("Template: resetOtp", () => {
    it("should include all palette colors, the code, expiry, and footer", () => {
      const html = resetOtpHtml({ code: "999000", minutesValid: 10 });
      expect(html).toContain(PALETTE.header);
      expect(html).toContain(PALETTE.accent);
      expect(html).toContain(PALETTE.background);
      expect(html).toContain("999000");
      expect(html).toContain("10 minutes");
      expect(html).toContain(FOOTER_MARKER);
    });

    it("plain-text should contain the code and safety notice", () => {
      const text = resetOtpText({ code: "777888", minutesValid: 10 });
      expect(text).toContain("777888");
      expect(text).toContain("safely ignore");
    });
  });

  describe("Template: passwordChanged", () => {
    it("should include palette, time, IP, and the security warning", () => {
      const html = passwordChangedHtml({
        changedAt: "2026-10-01 16:30:00 UTC",
        ip: "203.0.113.5",
      });
      expect(html).toContain(PALETTE.header);
      expect(html).toContain("203.0.113.5");
      expect(html).toContain("If this wasn't you");
      expect(html).toContain(FOOTER_MARKER);
    });

    it("plain-text should include IP and warning", () => {
      const text = passwordChangedText({
        changedAt: "2026-10-01 16:30:00 UTC",
        ip: "10.0.0.1",
      });
      expect(text).toContain("10.0.0.1");
      expect(text).toContain("If this wasn't you");
    });
  });

  describe("Template: newLoginAlert", () => {
    it("should include palette, timestamp, IP, user-agent, and warning", () => {
      const html = newLoginAlertHtml({
        timestamp: "2026-10-01T12:00:00.000Z",
        ip: "1.2.3.4",
        userAgent: "Mozilla/5.0 Test Browser",
      });
      expect(html).toContain(PALETTE.header);
      expect(html).toContain("1.2.3.4");
      expect(html).toContain("Mozilla/5.0 Test Browser");
      expect(html).toContain("If this wasn't you");
      expect(html).toContain(FOOTER_MARKER);
    });

    it("plain-text should include all details", () => {
      const text = newLoginAlertText({
        timestamp: "2026-10-01T12:00:00.000Z",
        ip: "5.6.7.8",
        userAgent: "curl/8.0",
      });
      expect(text).toContain("5.6.7.8");
      expect(text).toContain("curl/8.0");
    });
  });

  describe("Template: twoFactorEnabled", () => {
    it("should include palette, time, IP, and recovery code reminder", () => {
      const html = twoFactorEnabledHtml({
        changedAt: "2026-10-01 10:00:00 UTC",
        ip: "192.168.1.1",
      });
      expect(html).toContain(PALETTE.header);
      expect(html).toContain("192.168.1.1");
      expect(html).toContain("recovery codes");
      expect(html).toContain(FOOTER_MARKER);
    });

    it("plain-text should mention recovery codes", () => {
      const text = twoFactorEnabledText({
        changedAt: "2026-10-01 10:00:00 UTC",
        ip: "192.168.1.1",
      });
      expect(text).toContain("recovery codes");
    });
  });

  describe("Template: twoFactorDisabled", () => {
    it("should include palette and security warning", () => {
      const html = twoFactorDisabledHtml({
        changedAt: "2026-10-01 10:00:00 UTC",
        ip: "192.168.1.1",
      });
      expect(html).toContain(PALETTE.header);
      expect(html).toContain("If this wasn't you");
      expect(html).toContain(FOOTER_MARKER);
    });

    it("plain-text should contain the warning", () => {
      const text = twoFactorDisabledText({
        changedAt: "2026-10-01 10:00:00 UTC",
        ip: "192.168.1.1",
      });
      expect(text).toContain("If this wasn't you");
    });
  });

  describe("Template: accountLocked", () => {
    it("should include palette, attempt count, IP, and locked-until time", () => {
      const html = accountLockedHtml({
        lockedUntil: "2026-10-01 10:15:00 UTC",
        ip: "99.99.99.99",
        failedAttempts: 5,
      });
      expect(html).toContain(PALETTE.header);
      expect(html).toContain("99.99.99.99");
      expect(html).toContain("5");
      expect(html).toContain(FOOTER_MARKER);
    });

    it("plain-text should include all details", () => {
      const text = accountLockedText({
        lockedUntil: "2026-10-01 10:15:00 UTC",
        ip: "99.99.99.99",
        failedAttempts: 5,
      });
      expect(text).toContain("99.99.99.99");
      expect(text).toContain("5");
    });
  });

  // ── 3. sendMail dispatch ───────────────────────────────────────────────────

  describe("sendMail() dispatch", () => {
    it("should call transporter.sendMail with correct subject and both html+text parts", async () => {
      process.env.SMTP_USER = "mock@mock.com";
      process.env.SMTP_PASS = "mock-secret";

      let captured: any = null;
      setTransporter({
        verify: vi.fn().mockResolvedValue(true),
        sendMail: vi.fn().mockImplementation((opts) => {
          captured = opts;
          return Promise.resolve({ messageId: "test-id" });
        }),
      } as any);

      await sendMail({
        to: "user@example.com",
        subject: "Your SecureAuth password reset code",
        template: "resetOtp",
        data: { code: "123456", minutesValid: 10 },
      });

      expect(captured).not.toBeNull();
      expect(captured.to).toBe("user@example.com");
      expect(captured.subject).toBe("Your SecureAuth password reset code");
      // HTML must include the palette
      expect(captured.html).toContain(PALETTE.header);
      expect(captured.html).toContain("123456");
      // Plain-text fallback must exist
      expect(captured.text).toBeDefined();
      expect(captured.text).toContain("123456");
    });

    it("should NOT throw when SMTP credentials are missing — just log an error", async () => {
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;
      setTransporter(null);

      const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      // Must not throw
      await expect(
        sendMail({
          to: "test@example.com",
          subject: "Test",
          template: "verifyEmail",
          data: { code: "000000", minutesValid: 30 },
        })
      ).resolves.toBeUndefined();

      expect(errSpy).toHaveBeenCalledWith(
        expect.stringContaining("SMTP credentials missing")
      );
    });
  });

  // ── 4. Per-recipient rate limiting ─────────────────────────────────────────

  describe("Per-recipient email rate limit", () => {
    it("should allow up to EMAIL_RATE_LIMIT emails and block the next one", () => {
      const addr = "ratelimit@test.com";
      const LIMIT = 5; // matches EMAIL_RATE_LIMIT default

      for (let i = 1; i <= LIMIT; i++) {
        expect(checkEmailRateLimit(addr)).toBe(true);
      }
      // 6th should be rejected
      expect(checkEmailRateLimit(addr)).toBe(false);
    });

    it("should treat different addresses independently", () => {
      for (let i = 0; i < 5; i++) checkEmailRateLimit("a@test.com");
      // a@test.com is exhausted; b@test.com should still work
      expect(checkEmailRateLimit("b@test.com")).toBe(true);
    });

    it("should allow again after the window resets", () => {
      const addr = "window@test.com";
      for (let i = 0; i < 5; i++) checkEmailRateLimit(addr);
      expect(checkEmailRateLimit(addr)).toBe(false);

      // Manually rewind the window start to simulate expiry
      resetEmailRateStore();
      expect(checkEmailRateLimit(addr)).toBe(true);
    });

    it("sendMail should silently drop emails that exceed the rate limit", async () => {
      process.env.SMTP_USER = "mock@mock.com";
      process.env.SMTP_PASS = "mock-secret";

      const mockSendMail = vi.fn().mockResolvedValue({ messageId: "x" });
      setTransporter({
        verify: vi.fn(),
        sendMail: mockSendMail,
      } as any);

      const addr = "spam@test.com";

      // Send 5 (the limit)
      for (let i = 0; i < 5; i++) {
        await sendMail({
          to: addr,
          subject: "Test",
          template: "verifyEmail",
          data: { code: "000001", minutesValid: 30 },
        });
      }

      expect(mockSendMail).toHaveBeenCalledTimes(5);

      // 6th should be dropped silently
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      await sendMail({
        to: addr,
        subject: "Test",
        template: "verifyEmail",
        data: { code: "000001", minutesValid: 30 },
      });

      expect(mockSendMail).toHaveBeenCalledTimes(5); // not 6
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Rate limit exceeded")
      );
    });
  });

  // ── 5. End-to-end: verify-email flow ──────────────────────────────────────

  describe("End-to-end: email verification flow", () => {
    const user = {
      name: "E2E User",
      email: "e2e@verify.io",
      password: "SecurePass123!",
    };

    it("blocks login until email is verified, then allows after correct code", async () => {
      const { csrfToken, csrfCookie } = await getCsrf();

      // Register
      const regRes = await request(app)
        .post("/api/auth/register")
        .set("Cookie", [csrfCookie])
        .set("x-csrf-token", csrfToken)
        .send(user);

      expect(regRes.status).toBe(201);
      expect(regRes.body.emailVerificationRequired).toBe(true);

      // Login attempt blocked
      const blockedLogin = await request(app)
        .post("/api/auth/login")
        .set("Cookie", [csrfCookie])
        .set("x-csrf-token", csrfToken)
        .send({ email: user.email, password: user.password });

      expect(blockedLogin.status).toBe(403);
      expect(blockedLogin.body.emailVerificationRequired).toBe(true);

      // Inject a known test code
      const dbUser = db
        .prepare("SELECT * FROM users WHERE email = ?")
        .get(user.email.toLowerCase()) as any;
      const ver = db
        .prepare(
          "SELECT * FROM email_verifications WHERE user_id = ? AND consumed_at IS NULL LIMIT 1"
        )
        .get(dbUser.id) as any;

      const testCode = "987654";
      db.prepare("UPDATE email_verifications SET code_hash = ? WHERE id = ?").run(
        hashOtp(testCode),
        ver.id
      );

      // Submit the correct code
      const verRes = await request(app)
        .post("/api/auth/verify-email")
        .set("Cookie", [csrfCookie])
        .set("x-csrf-token", csrfToken)
        .send({ email: user.email, code: testCode });

      expect(verRes.status).toBe(200);
      expect(verRes.body.success).toBe(true);
      expect(verRes.body.user.emailVerified).toBe(true);

      // Session issued
      const sessionCookie = getCookies(verRes).find((c) =>
        c.startsWith(`${AUTH_CONFIG.COOKIE_NAME}=`)
      );
      expect(sessionCookie).toBeDefined();

      // Subsequent login should now succeed
      const loginRes = await request(app)
        .post("/api/auth/login")
        .set("Cookie", [csrfCookie])
        .set("x-csrf-token", csrfToken)
        .send({ email: user.email, password: user.password });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.success).toBe(true);
    });
  });

  // ── 6. Forgot-Password neutral response ───────────────────────────────────

  describe("Forgot-Password Route Neutral Response", () => {
    it("should return neutral response whether user exists or not, and even if email fails", async () => {
      // 1. Get CSRF token
      const csrfRes = await request(app).get("/api/auth/csrf-token");
      const token = csrfRes.body.csrfToken;
      const cookies = csrfRes.headers["set-cookie"] as unknown as string[];

      // 2. Request for non-existent email
      const nonExistentRes = await request(app)
        .post("/api/auth/forgot-password")
        .set("Cookie", cookies)
        .set("x-csrf-token", token)
        .send({ email: "definitely-not-found@example.com" });

      expect(nonExistentRes.status).toBe(200);
      expect(nonExistentRes.body.success).toBe(true);
      expect(nonExistentRes.body.message).toContain("If that email exists, we've sent a code");

      // 3. Request for an existing seeded user (need one to exist)
      // Insert a verified test user
      const { hashPassword } = await import("../crypto.js");
      const pwdHash = await hashPassword("SeedTest123!");
      db.prepare(
        "INSERT OR IGNORE INTO users (id, name, email, password_hash, created_at, email_verified, known_ips) VALUES (?, ?, ?, ?, ?, 1, '[]')"
      ).run("seed-test-id", "Seed User", "seed@test.io", pwdHash, new Date().toISOString());

      const existingRes = await request(app)
        .post("/api/auth/forgot-password")
        .set("Cookie", cookies)
        .set("x-csrf-token", token)
        .send({ email: "seed@test.io" });

      expect(existingRes.status).toBe(200);
      expect(existingRes.body.success).toBe(true);
      expect(existingRes.body.message).toBe(nonExistentRes.body.message);
    });
  });

  // ── 7. Alert emails fire on the right lifecycle events ────────────────────

  describe("Security alert emails fire on correct events", () => {
    it("accountLocked email fires when account hits lockout threshold", async () => {
      const mockSendMail = vi.fn().mockResolvedValue({ messageId: "x" });
      setTransporter({
        verify: vi.fn(),
        sendMail: mockSendMail,
      } as any);
      process.env.SMTP_USER = "mock@mock.com";
      process.env.SMTP_PASS = "mock-secret";

      const { csrfToken, csrfCookie } = await getCsrf();
      const targetEmail = "lockme@test.com";

      // Register + verify
      await request(app)
        .post("/api/auth/register")
        .set("Cookie", [csrfCookie])
        .set("x-csrf-token", csrfToken)
        .send({ name: "Lock Me", email: targetEmail, password: "SecurePass123!" });
      db.prepare("UPDATE users SET email_verified = 1 WHERE email = ?").run(
        targetEmail.toLowerCase()
      );
      // Reset rate store so our 5 bad-login emails don't hit the limit
      resetEmailRateStore();

      // Trigger 5 failed logins
      for (let i = 0; i < AUTH_CONFIG.MAX_FAILED_LOGIN_ATTEMPTS; i++) {
        await request(app)
          .post("/api/auth/login")
          .set("Cookie", [csrfCookie])
          .set("x-csrf-token", csrfToken)
          .send({ email: targetEmail, password: "wrongPassXXX!" });
      }

      // Allow micro-tasks to flush
      await new Promise((r) => setTimeout(r, 50));

      // sendMail should have been called with accountLocked template
      const accountLockedCall = mockSendMail.mock.calls.find((args: any[]) => {
        const opts = args[0];
        return opts.subject && opts.subject.includes("locked");
      });
      expect(accountLockedCall).toBeDefined();
    });
  });
});
