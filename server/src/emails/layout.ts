/**
 * Shared email layout for all SecureAuth transactional emails.
 *
 * Palette
 * ───────
 *   Header background : #0B2925  (Deep Forest Green)
 *   Accent / mint     : #A7F3D0  (Emerald Mint)
 *   Page background   : #F8F5F3  (Warm Off-White)
 *   Card background   : #FFFFFF
 */

/**
 * Wraps body HTML inside the standard SecureAuth header + footer chrome.
 *
 * @param bodyHtml   The inner content rows (between header and footer)
 * @param badgeLabel Short badge text shown in the header (e.g. "Verification")
 */
export function wrapLayout(bodyHtml: string, badgeLabel = "Security"): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SecureAuth Security Notice</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F8F5F3; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1C1917;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F8F5F3; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 540px; background-color: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(11, 41, 37, 0.08); border: 1px solid #E7E5E4;">
          <!-- Header -->
          <tr>
            <td style="background-color: #0B2925; padding: 26px 32px; text-align: left;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <span style="font-size: 22px; font-weight: 700; color: #FFFFFF; letter-spacing: -0.5px;">SecureAuth</span>
                    <span style="display: inline-block; width: 8px; height: 8px; background-color: #A7F3D0; border-radius: 50%; margin-left: 6px; vertical-align: middle;"></span>
                  </td>
                  <td align="right">
                    <span style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #A7F3D0; background-color: rgba(167, 243, 208, 0.12); padding: 4px 10px; border-radius: 9999px; border: 1px solid rgba(167, 243, 208, 0.25);">${badgeLabel}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Accent line -->
          <tr>
            <td style="height: 3px; background-color: #A7F3D0;"></td>
          </tr>
          <!-- Body content injected here -->
          ${bodyHtml}
          <!-- Footer -->
          <tr>
            <td style="background-color: #F8F5F3; padding: 20px 32px; border-top: 1px solid #E7E5E4; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #78716C; line-height: 1.5;">
                This is an automated security email &bull; SecureAuth Enterprise Security Platform
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Standard plain-text wrapper.
 * Adds a SecureAuth header and footer around the provided body lines.
 */
export function wrapTextLayout(bodyLines: string[]): string {
  return [
    "SecureAuth — Security Notice",
    "════════════════════════════",
    "",
    ...bodyLines,
    "",
    "────────────────────────────",
    "This is an automated security email from SecureAuth.",
    "If you did not expect this email, please contact support immediately.",
  ].join("\n");
}
