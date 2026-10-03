/**
 * Central email service — the ONLY file that touches nodemailer.
 *
 * Public surface
 * ──────────────
 *   sendMail({ to, subject, template, data })   — async, never throws to the caller
 *   verifySmtp()                                 — SMTP health-check on startup
 *   setTransporter(t)                            — test helper
 *
 * Template registry
 * ─────────────────
 *   verifyEmail      → server/src/emails/verifyEmail.ts
 *   resetOtp         → server/src/emails/resetOtp.ts
 *   passwordChanged  → server/src/emails/passwordChanged.ts
 *   newLoginAlert    → server/src/emails/newLoginAlert.ts
 *   twoFactorEnabled → server/src/emails/twoFactorStatus.ts
 *   twoFactorDisabled→ server/src/emails/twoFactorStatus.ts
 *   accountLocked    → server/src/emails/accountLocked.ts
 *
 * Rate limiting
 * ─────────────
 *   At most EMAIL_RATE_LIMIT emails per EMAIL_RATE_WINDOW_MS per recipient address.
 *   Excess calls are silently dropped (logged server-side) so the caller never sees an error.
 *
 * Security invariants
 * ───────────────────
 *   - Passwords, tokens, and full OTP hashes are never put in emails or logs.
 *   - OTP codes appear only inside the rendered email body (handled by templates).
 *   - Sending is always asynchronous: callers use void sendMail(…) and never await.
 */

import "../env.js";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

// Template imports
import { verifyEmailHtml, verifyEmailText, type VerifyEmailData } from "../emails/verifyEmail.js";
import { resetOtpHtml, resetOtpText, type ResetOtpData } from "../emails/resetOtp.js";
import {
  passwordChangedHtml,
  passwordChangedText,
  type PasswordChangedData,
} from "../emails/passwordChanged.js";
import {
  newLoginAlertHtml,
  newLoginAlertText,
  type NewLoginAlertData,
} from "../emails/newLoginAlert.js";
import {
  twoFactorEnabledHtml,
  twoFactorEnabledText,
  twoFactorDisabledHtml,
  twoFactorDisabledText,
  type TwoFactorStatusData,
} from "../emails/twoFactorStatus.js";
import {
  accountLockedHtml,
  accountLockedText,
  type AccountLockedData,
} from "../emails/accountLocked.js";

// ── Rate limiting ─────────────────────────────────────────────────────────────

/** Maximum emails per recipient per window */
const EMAIL_RATE_LIMIT = parseInt(process.env.EMAIL_RATE_LIMIT ?? "5", 10);
/** Window size in milliseconds (default: 1 hour) */
const EMAIL_RATE_WINDOW_MS = parseInt(
  process.env.EMAIL_RATE_WINDOW_MS ?? String(60 * 60 * 1000),
  10
);

interface RateEntry {
  count: number;
  windowStart: number;
}

/** In-process per-recipient email rate-limit store */
const emailRateStore = new Map<string, RateEntry>();

/**
 * Returns true if sending to `address` is allowed under the rate limit.
 * Advances the counter if allowed.
 */
export function checkEmailRateLimit(address: string): boolean {
  const now = Date.now();
  const entry = emailRateStore.get(address);

  if (!entry || now - entry.windowStart >= EMAIL_RATE_WINDOW_MS) {
    // First email in the window — allow and open a fresh window
    emailRateStore.set(address, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= EMAIL_RATE_LIMIT) {
    return false;
  }

  entry.count += 1;
  return true;
}

/** Exposed for tests so they can inspect or reset rate limit state. */
export function resetEmailRateStore(): void {
  emailRateStore.clear();
}

// ── Transporter ───────────────────────────────────────────────────────────────

export interface TransporterConfig {
  host: string;
  port: number;
  secure: boolean;
  requireTLS?: boolean;
  user?: string;
  pass?: string;
}

export function createTransporterForConfig(options: TransporterConfig): Transporter {
  return nodemailer.createTransport({
    host: options.host,
    port: options.port,
    secure: options.secure,
    requireTLS: options.requireTLS,
    auth: options.user && options.pass ? { user: options.user, pass: options.pass } : undefined,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}

let transporterInstance: Transporter | null = null;

/** Test helper — inject a mock transporter. */
export function setTransporter(t: Transporter | null): void {
  transporterInstance = t;
}

export function getTransporter(): Transporter {
  if (!transporterInstance) {
    const host = process.env.SMTP_HOST || "smtp.gmail.com";
    const port = parseInt(process.env.SMTP_PORT || "587", 10);
    const secure = process.env.SMTP_SECURE === "true" || port === 465;
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.trim();

    transporterInstance = createTransporterForConfig({
      host,
      port,
      secure,
      requireTLS: !secure && port === 587,
      user,
      pass,
    });
  }
  return transporterInstance;
}

/**
 * Verifies the SMTP connection at startup.
 * Falls back from port 465 → 587 automatically.
 */
export async function verifySmtp(): Promise<{ ok: boolean; message: string }> {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();

  if (!user || !pass) {
    const missing: string[] = [];
    if (!user) missing.push("SMTP_USER");
    if (!pass) missing.push("SMTP_PASS");
    const reason = `Missing credentials in environment variables (${missing.join(", ")})`;
    console.error(`SMTP failed: ${reason}`);
    return { ok: false, message: reason };
  }

  const primaryTransporter = getTransporter();

  try {
    await primaryTransporter.verify();
    console.log("SMTP ready");
    return { ok: true, message: "SMTP ready" };
  } catch (error: any) {
    if (port === 465) {
      try {
        const fallbackTransporter = createTransporterForConfig({
          host,
          port: 587,
          secure: false,
          requireTLS: true,
          user,
          pass,
        });
        await fallbackTransporter.verify();
        setTransporter(fallbackTransporter);
        console.log("SMTP ready");
        return { ok: true, message: "SMTP ready" };
      } catch (fallbackError: any) {
        const reason = fallbackError?.message || String(fallbackError);
        console.error(`SMTP failed: ${reason}`);
        return { ok: false, message: reason };
      }
    }

    const reason = error?.message || String(error);
    console.error(`SMTP failed: ${reason}`);
    return { ok: false, message: reason };
  }
}

// ── Template map ──────────────────────────────────────────────────────────────

type TemplateMap = {
  verifyEmail: VerifyEmailData;
  resetOtp: ResetOtpData;
  passwordChanged: PasswordChangedData;
  newLoginAlert: NewLoginAlertData;
  twoFactorEnabled: TwoFactorStatusData;
  twoFactorDisabled: TwoFactorStatusData;
  accountLocked: AccountLockedData;
};

type TemplateName = keyof TemplateMap;

interface SendMailOptions<T extends TemplateName> {
  to: string;
  subject: string;
  template: T;
  data: TemplateMap[T];
}

function renderTemplate<T extends TemplateName>(
  template: T,
  data: TemplateMap[T]
): { html: string; text: string } {
  switch (template) {
    case "verifyEmail":
      return {
        html: verifyEmailHtml(data as VerifyEmailData),
        text: verifyEmailText(data as VerifyEmailData),
      };
    case "resetOtp":
      return {
        html: resetOtpHtml(data as ResetOtpData),
        text: resetOtpText(data as ResetOtpData),
      };
    case "passwordChanged":
      return {
        html: passwordChangedHtml(data as PasswordChangedData),
        text: passwordChangedText(data as PasswordChangedData),
      };
    case "newLoginAlert":
      return {
        html: newLoginAlertHtml(data as NewLoginAlertData),
        text: newLoginAlertText(data as NewLoginAlertData),
      };
    case "twoFactorEnabled":
      return {
        html: twoFactorEnabledHtml(data as TwoFactorStatusData),
        text: twoFactorEnabledText(data as TwoFactorStatusData),
      };
    case "twoFactorDisabled":
      return {
        html: twoFactorDisabledHtml(data as TwoFactorStatusData),
        text: twoFactorDisabledText(data as TwoFactorStatusData),
      };
    case "accountLocked":
      return {
        html: accountLockedHtml(data as AccountLockedData),
        text: accountLockedText(data as AccountLockedData),
      };
    default:
      throw new Error(`Unknown email template: ${template}`);
  }
}

// ── Public sendMail ───────────────────────────────────────────────────────────

/**
 * Send a transactional security email.
 *
 * This function is intentionally ASYNC-FIRE-AND-FORGET: callers MUST use
 *   `void sendMail({ … });`
 * Never await this — SMTP errors are caught and logged internally so they
 * never propagate to or affect the HTTP response.
 *
 * Per-recipient rate limit: at most EMAIL_RATE_LIMIT emails per EMAIL_RATE_WINDOW_MS.
 */
export async function sendMail<T extends TemplateName>(
  options: SendMailOptions<T>
): Promise<void> {
  const { to, subject, template, data } = options;

  // ── Rate limit check ──────────────────────────────────────────────────────
  if (!checkEmailRateLimit(to)) {
    console.warn(`[emailService] Rate limit exceeded for ${to} — skipping ${template} email`);
    return;
  }

  // ── Credential guard ──────────────────────────────────────────────────────
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  if ((!user || !pass) && !transporterInstance) {
    console.error("[emailService] SMTP credentials missing — email not sent");
    return;
  }

  const from = process.env.MAIL_FROM || `"SecureAuth" <${user}>`;

  // ── Render template ────────────────────────────────────────────────────────
  let rendered: { html: string; text: string };
  try {
    rendered = renderTemplate(template, data);
  } catch (err) {
    console.error(`[emailService] Template render error (${template}):`, err);
    return;
  }

  const mailOptions = { from, to, subject, html: rendered.html, text: rendered.text };
  const transporter = getTransporter();

  // ── Send ──────────────────────────────────────────────────────────────────
  try {
    await transporter.sendMail(mailOptions);
  } catch (primaryErr: any) {
    // Port 465 fallback
    const port = parseInt(process.env.SMTP_PORT || "587", 10);
    if (port === 465) {
      try {
        const host = process.env.SMTP_HOST || "smtp.gmail.com";
        const fallback = createTransporterForConfig({
          host,
          port: 587,
          secure: false,
          requireTLS: true,
          user,
          pass,
        });
        await fallback.sendMail(mailOptions);
        setTransporter(fallback);
        return;
      } catch (fallbackErr: any) {
        console.error(
          `[emailService] Failed to send "${template}" to ${to} (fallback):`,
          fallbackErr?.message ?? fallbackErr
        );
        return;
      }
    }
    console.error(
      `[emailService] Failed to send "${template}" to ${to}:`,
      primaryErr?.message ?? primaryErr
    );
  }
}

// ── Legacy alias ──────────────────────────────────────────────────────────────
// Kept for backward compatibility with existing code and tests that call sendOtpEmail directly.

export interface SendOtpResult {
  messageId?: string;
  accepted?: any[];
  rejected?: any[];
  response?: string;
}

/**
 * @deprecated Use sendMail({ template: "resetOtp", … }) instead.
 * Kept only so existing tests and the test:email script compile unchanged.
 */
export async function sendOtpEmail(
  to: string,
  code: string,
  minutesValid: number
): Promise<SendOtpResult> {
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();

  if ((!user || !pass) && !transporterInstance) {
    throw new Error(
      "SMTP credentials missing: SMTP_USER and SMTP_PASS must be configured in environment variables to send emails"
    );
  }

  const from = process.env.MAIL_FROM || `"SecureAuth" <${user}>`;
  const { resetOtpHtml: html, resetOtpText: text } = await (async () => {
    const { resetOtpHtml, resetOtpText } = await import("../emails/resetOtp.js");
    return {
      resetOtpHtml: resetOtpHtml({ code, minutesValid }),
      resetOtpText: resetOtpText({ code, minutesValid }),
    };
  })();

  const mailOptions = {
    from,
    to,
    subject: "Your SecureAuth verification code",
    html,
    text,
  };

  const transporter = getTransporter();

  try {
    const info = await transporter.sendMail(mailOptions);
    return {
      messageId: info?.messageId,
      accepted: info?.accepted,
      rejected: info?.rejected,
      response: info?.response,
    };
  } catch (error: any) {
    const port = parseInt(process.env.SMTP_PORT || "587", 10);
    if (port === 465) {
      try {
        const host = process.env.SMTP_HOST || "smtp.gmail.com";
        const fallbackTransporter = createTransporterForConfig({
          host,
          port: 587,
          secure: false,
          requireTLS: true,
          user,
          pass,
        });
        const fallbackInfo = await fallbackTransporter.sendMail(mailOptions);
        setTransporter(fallbackTransporter);
        return {
          messageId: fallbackInfo?.messageId,
          accepted: fallbackInfo?.accepted,
          rejected: fallbackInfo?.rejected,
          response: fallbackInfo?.response,
        };
      } catch (fallbackError: any) {
        throw fallbackError;
      }
    }
    throw error;
  }
}
