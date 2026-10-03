/**
 * twoFactorStatus templates (enabled / disabled)
 *
 * Sent when two-factor authentication is enabled or disabled on an account.
 */

import { wrapLayout, wrapTextLayout } from "./layout.js";

export interface TwoFactorStatusData {
  changedAt: string; // ISO string
  ip: string;
}

// ── Enabled ───────────────────────────────────────────────────────────────────

export function twoFactorEnabledHtml(data: TwoFactorStatusData): string {
  const body = `
  <tr>
    <td style="padding: 36px 32px 28px 32px;">
      <h1 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #0B2925; line-height: 1.3;">Two-Factor Authentication Enabled</h1>
      <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #44403C;">
        Two-factor authentication (2FA) has been successfully enabled on your SecureAuth account.
        Your account is now better protected.
      </p>

      <!-- Details -->
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 0 0 24px 0; border: 1px solid #E7E5E4; border-radius: 8px; overflow: hidden;">
        <tr>
          <td style="padding: 12px 16px; background-color: #F8F5F3; border-bottom: 1px solid #E7E5E4;">
            <span style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: #78716C;">Time</span>
          </td>
          <td style="padding: 12px 16px; background-color: #F8F5F3; border-bottom: 1px solid #E7E5E4;">
            <span style="font-size: 14px; color: #1C1917;">${data.changedAt}</span>
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; background-color: #FFFFFF;">
            <span style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: #78716C;">IP Address</span>
          </td>
          <td style="padding: 12px 16px; background-color: #FFFFFF;">
            <span style="font-family: 'SF Mono', Consolas, monospace; font-size: 13px; color: #1C1917;">${data.ip}</span>
          </td>
        </tr>
      </table>

      <!-- Info -->
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 0 0 16px 0;">
        <tr>
          <td style="background-color: #F0FDF4; border-left: 3px solid #059669; padding: 12px 16px; border-radius: 0 8px 8px 0;">
            <p style="margin: 0; font-size: 13px; color: #065F46; line-height: 1.5; font-weight: 500;">
              ✅ Keep your recovery codes safe. They are the only way to access your account if you lose your authenticator device.
            </p>
          </td>
        </tr>
      </table>

      <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #78716C;">
        If you didn't make this change, contact support immediately and reset your password.
      </p>
    </td>
  </tr>`;

  return wrapLayout(body, "2FA Enabled");
}

export function twoFactorEnabledText(data: TwoFactorStatusData): string {
  return wrapTextLayout([
    "Two-Factor Authentication Enabled",
    "",
    "Two-factor authentication (2FA) has been successfully enabled on your SecureAuth account.",
    "Your account is now better protected.",
    "",
    `Time       : ${data.changedAt}`,
    `IP Address : ${data.ip}`,
    "",
    "Keep your recovery codes safe. They are the only way to access your account if you lose your authenticator device.",
    "If you didn't make this change, contact support immediately and reset your password.",
  ]);
}

// ── Disabled ──────────────────────────────────────────────────────────────────

export function twoFactorDisabledHtml(data: TwoFactorStatusData): string {
  const body = `
  <tr>
    <td style="padding: 36px 32px 28px 32px;">
      <h1 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #0B2925; line-height: 1.3;">Two-Factor Authentication Disabled</h1>
      <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #44403C;">
        Two-factor authentication (2FA) has been disabled on your SecureAuth account.
      </p>

      <!-- Details -->
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 0 0 24px 0; border: 1px solid #E7E5E4; border-radius: 8px; overflow: hidden;">
        <tr>
          <td style="padding: 12px 16px; background-color: #F8F5F3; border-bottom: 1px solid #E7E5E4;">
            <span style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: #78716C;">Time</span>
          </td>
          <td style="padding: 12px 16px; background-color: #F8F5F3; border-bottom: 1px solid #E7E5E4;">
            <span style="font-size: 14px; color: #1C1917;">${data.changedAt}</span>
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; background-color: #FFFFFF;">
            <span style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: #78716C;">IP Address</span>
          </td>
          <td style="padding: 12px 16px; background-color: #FFFFFF;">
            <span style="font-family: 'SF Mono', Consolas, monospace; font-size: 13px; color: #1C1917;">${data.ip}</span>
          </td>
        </tr>
      </table>

      <!-- Warning -->
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 0 0 16px 0;">
        <tr>
          <td style="background-color: #FEF2F2; border-left: 3px solid #DC2626; padding: 12px 16px; border-radius: 0 8px 8px 0;">
            <p style="margin: 0; font-size: 13px; color: #991B1B; line-height: 1.5; font-weight: 500;">
              ⚠️ <strong>If this wasn't you</strong>, your account may be compromised.
              Reset your password and re-enable 2FA immediately.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;

  return wrapLayout(body, "Security Alert");
}

export function twoFactorDisabledText(data: TwoFactorStatusData): string {
  return wrapTextLayout([
    "Two-Factor Authentication Disabled",
    "",
    "Two-factor authentication (2FA) has been disabled on your SecureAuth account.",
    "",
    `Time       : ${data.changedAt}`,
    `IP Address : ${data.ip}`,
    "",
    "If this wasn't you, your account may be compromised.",
    "Reset your password and re-enable 2FA immediately.",
  ]);
}
