/**
 * passwordChanged template
 *
 * Sent after a successful password reset or change.
 * Includes the time, IP and a call-to-action if the user didn't initiate the change.
 */

import { wrapLayout, wrapTextLayout } from "./layout.js";

export interface PasswordChangedData {
  changedAt: string; // ISO string
  ip: string;
}

export function passwordChangedHtml(data: PasswordChangedData): string {
  const body = `
  <tr>
    <td style="padding: 36px 32px 28px 32px;">
      <h1 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #0B2925; line-height: 1.3;">Your Password Has Been Changed</h1>
      <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #44403C;">
        Your SecureAuth account password was successfully updated.
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
              Reset your password immediately.
            </p>
          </td>
        </tr>
      </table>

      <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #78716C;">
        All active sessions were revoked as part of this change.
      </p>
    </td>
  </tr>`;

  return wrapLayout(body, "Security Alert");
}

export function passwordChangedText(data: PasswordChangedData): string {
  return wrapTextLayout([
    "Your Password Has Been Changed",
    "",
    "Your SecureAuth account password was successfully updated.",
    "",
    `Time       : ${data.changedAt}`,
    `IP Address : ${data.ip}`,
    "",
    "If this wasn't you, your account may be compromised.",
    "Reset your password immediately.",
    "",
    "All active sessions were revoked as part of this change.",
  ]);
}
