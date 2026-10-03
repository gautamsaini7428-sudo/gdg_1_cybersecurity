/**
 * resetOtp template
 *
 * Sent when a user requests a password reset.
 * Contains the 6-digit one-time code they must enter to proceed.
 */

import { wrapLayout, wrapTextLayout } from "./layout.js";

export interface ResetOtpData {
  code: string;
  minutesValid: number;
}

export function resetOtpHtml(data: ResetOtpData): string {
  const body = `
  <tr>
    <td style="padding: 36px 32px 28px 32px;">
      <h1 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #0B2925; line-height: 1.3;">Your Password Reset Code</h1>
      <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #44403C;">
        Use the single-use code below to complete your password reset request.
      </p>

      <!-- Code box -->
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 0 0 24px 0;">
        <tr>
          <td align="center" style="background-color: #F8F5F3; border: 1px solid #A7F3D0; border-radius: 10px; padding: 22px 16px;">
            <div style="font-family: 'SF Mono', Consolas, Monaco, Menlo, 'Liberation Mono', 'Courier New', monospace; font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #0B2925; text-indent: 8px;">
              ${data.code}
            </div>
          </td>
        </tr>
      </table>

      <!-- Expiry info -->
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 0 0 24px 0;">
        <tr>
          <td style="background-color: #F0FDF4; border-left: 3px solid #059669; padding: 12px 16px; border-radius: 0 8px 8px 0;">
            <p style="margin: 0; font-size: 13px; color: #065F46; line-height: 1.5; font-weight: 500;">
              ⏱ This code is valid for <strong>${data.minutesValid} minutes</strong>.
            </p>
          </td>
        </tr>
      </table>

      <p style="margin: 0 0 8px 0; font-size: 14px; line-height: 1.6; color: #57534E;">
        If you didn't request a password reset, you can safely ignore this email. Your password will not change.
      </p>
    </td>
  </tr>`;

  return wrapLayout(body, "Password Reset");
}

export function resetOtpText(data: ResetOtpData): string {
  return wrapTextLayout([
    "Your Password Reset Code",
    "",
    "Use the single-use code below to complete your password reset request:",
    "",
    `    ${data.code}`,
    "",
    `This code will expire in ${data.minutesValid} minutes.`,
    "If you didn't request this, you can safely ignore this email. Your password will not change.",
  ]);
}
