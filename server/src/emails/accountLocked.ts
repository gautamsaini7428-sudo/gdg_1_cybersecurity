/**
 * accountLocked template
 *
 * Sent when an account is locked due to repeated failed login attempts.
 */

import { wrapLayout, wrapTextLayout } from "./layout.js";

export interface AccountLockedData {
  lockedUntil: string;   // Human-readable date string
  ip: string;
  failedAttempts: number;
}

export function accountLockedHtml(data: AccountLockedData): string {
  const body = `
  <tr>
    <td style="padding: 36px 32px 28px 32px;">
      <h1 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #0B2925; line-height: 1.3;">Account Temporarily Locked</h1>
      <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #44403C;">
        Your SecureAuth account has been temporarily locked after <strong>${data.failedAttempts}</strong> consecutive failed sign-in attempts.
      </p>

      <!-- Details -->
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 0 0 24px 0; border: 1px solid #E7E5E4; border-radius: 8px; overflow: hidden;">
        <tr>
          <td style="padding: 12px 16px; background-color: #F8F5F3; border-bottom: 1px solid #E7E5E4;">
            <span style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: #78716C;">Locked Until</span>
          </td>
          <td style="padding: 12px 16px; background-color: #F8F5F3; border-bottom: 1px solid #E7E5E4;">
            <span style="font-size: 14px; color: #1C1917;">${data.lockedUntil}</span>
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; background-color: #FFFFFF; border-bottom: 1px solid #E7E5E4;">
            <span style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: #78716C;">Failed Attempts</span>
          </td>
          <td style="padding: 12px 16px; background-color: #FFFFFF; border-bottom: 1px solid #E7E5E4;">
            <span style="font-size: 14px; color: #1C1917;">${data.failedAttempts}</span>
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; background-color: #F8F5F3;">
            <span style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: #78716C;">IP Address</span>
          </td>
          <td style="padding: 12px 16px; background-color: #F8F5F3;">
            <span style="font-family: 'SF Mono', Consolas, monospace; font-size: 13px; color: #1C1917;">${data.ip}</span>
          </td>
        </tr>
      </table>

      <!-- Warning -->
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 0 0 16px 0;">
        <tr>
          <td style="background-color: #FEF2F2; border-left: 3px solid #DC2626; padding: 12px 16px; border-radius: 0 8px 8px 0;">
            <p style="margin: 0; font-size: 13px; color: #991B1B; line-height: 1.5; font-weight: 500;">
              ⚠️ If you didn't make these attempts, someone else may be trying to access your account.
              Use password reset to regain access and update your credentials.
            </p>
          </td>
        </tr>
      </table>

      <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #78716C;">
        Your account will automatically unlock after the lockout period expires.
      </p>
    </td>
  </tr>`;

  return wrapLayout(body, "Account Locked");
}

export function accountLockedText(data: AccountLockedData): string {
  return wrapTextLayout([
    "Account Temporarily Locked",
    "",
    `Your account has been locked after ${data.failedAttempts} consecutive failed sign-in attempts.`,
    "",
    `Locked Until    : ${data.lockedUntil}`,
    `Failed Attempts : ${data.failedAttempts}`,
    `IP Address      : ${data.ip}`,
    "",
    "If you didn't make these attempts, someone else may be trying to access your account.",
    "Use password reset to regain access and update your credentials.",
    "",
    "Your account will automatically unlock after the lockout period expires.",
  ]);
}
