/**
 * CSRF protection middleware using the Double-Submit Cookie pattern via csrf-csrf.
 *
 * How it works:
 *   1. GET /api/auth/csrf-token  →  server sends a signed token in a cookie AND
 *      returns it as JSON so the client can store it in memory.
 *   2. Every state-changing request (POST/PUT/DELETE) must include the token in
 *      the `x-csrf-token` request header (never in a URL/body-only location).
 *   3. The `doubleCsrfProtection` middleware validates the header token against
 *      the signed cookie before passing to the route handler.
 *
 * The token is bound to the session secret so it cannot be forged by a third-
 * party site — it satisfies the SameSite=Lax cookie requirement for SPAs where
 * cross-origin AJAX is blocked but cross-origin navigations are allowed.
 */

import { doubleCsrf } from "csrf-csrf";
import type { Request } from "express";
import { AUTH_CONFIG } from "../../../shared/const.js";

const IS_PROD = process.env.NODE_ENV === "production";

export const { generateToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => process.env.SESSION_SECRET ?? "dev-csrf-secret-minimum-32-chars-long",
  getSessionIdentifier: (req: Request) => (req.ip || "anonymous"),
  cookieName: "sa.csrf",
  cookieOptions: {
    httpOnly: false, // Must be readable by client JS to send in header
    secure: IS_PROD,
    sameSite: IS_PROD ? "strict" : "lax",
    path: "/",
  },
  getTokenFromRequest: (req: Request) =>
    (req.headers[AUTH_CONFIG.CSRF_HEADER] || req.headers["x-csrf-token"]) as string | undefined,
  size: 64,
});
