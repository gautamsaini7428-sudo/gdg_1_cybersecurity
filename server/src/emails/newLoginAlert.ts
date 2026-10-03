/**
 * newLoginAlert template
 *
 * Sent when a successful login originates from an IP address or user-agent
 * that has not been seen before for this account.
 */

import { wrapLayout, wrapTextLayout } from "./layout.js";

export interface NewLoginAlertData {
  timestamp: string; // ISO string
  ip: string;
  userAgent: string;
}

export function newLoginAlertHtml(data: NewLoginAlertData): string {
  const body = `
  <tr>
    <td style="padding: 36px 32px 28px 32px;">
      <h1 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #0B2925; line-height: 1.3;">New Sign-In Detected</h1>
      <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #44403C;">
        We detected a sign-in to your SecureAuth account from a new location or device.
      </p>

      <!-- Details -->
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 0 0 24px 0; border: 1px solid #E7E5E4; border-radius: 8px; overflow: hidden;">
        <tr>
          <td style="padding: 12px 16px; background-color: #F8F5F3; border-bottom: 1px solid #E7E5E4;">
            <span style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: #78716C;">Time</span>
          </td>
          <td style="padding: 12px 16px; background-color: #F8F5F3; border-bottom: 1px solid #E7E5E4;">
            <span style="font-size: 14px; color: #1C1917;">${data.timestamp}</span>
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; background-color: #FFFFFF; border-bottom: 1px solid #E7E5E4;">
            <span style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: #78716C;">IP Address</span>
          </td>
          <td style="padding: 12px 16px; background-color: #FFFFFF; border-bottom: 1px solid #E7E5E4;">
            <span style="font-family: 'SF Mono', Consolas, monospace; font-size: 13px; color: #1C1917;">${data.ip}</span>
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; background-color: #F8F5F3;">
            <span style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: #78716C;">Device</span>
          </td>
          <td style="padding: 12px 16px; background-color: #F8F5F3;">
            <span style="font-size: 13px; color: #44403C; word-break: break-all;">${data.userAgent}</span>
          </td>
        </tr>
      </table>

      <!-- Warning -->
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 0 0 16px 0;">
        <tr>
          <td style="background-color: #FEF2F2; border-left: 3px solid #DC2626; padding: 12px 16px; border-radius: 0 8px 8px 0;">
            <p style="margin: 0; font-size: 13px; color: #991B1B; line-height: 1.5; font-weight: 500;">
              ⚠️ <strong>If this wasn't you</strong>, reset your password immediately and enable two-factor authentication.
            </p>
          </td>
        </tr>
      </table>

      <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #78716C;">
        If this was you, no action is needed.
      </p>
    </td>
  </tr>`;

  return wrapLayout(body, "Login Alert");
}

export function newLoginAlertText(data: NewLoginAlertData): string {
  return wrapTextLayout([
    "New Sign-In Detected",
    "",
    "We detected a sign-in to your SecureAuth account from a new location or device.",
    "",
    `Time       : ${data.timestamp}`,
    `IP Address : ${data.ip}`,
    `Device     : ${data.userAgent}`,
    "",
    "If this wasn't you, reset your password immediately and enable two-factor authentication.",
    "If this was you, no action is needed.",
  ]);
}
